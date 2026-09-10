import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { fetchSeasonCalendars, fixtureKey, playedOnFrom } from "./calendar-source.js";

/**
 * Imports the season's calendar: what each week is for, and the night each
 * fixture is actually played on.
 *
 * Two things the fixture import cannot know, because neither is on the page
 * it reads. `MatchHistory.asp` lists a match against the Monday its week
 * commences, so the first pass at the programme put that Monday in both
 * `week_commencing` and `played_on` — 184 fixtures all apparently played on
 * a Monday, in a league where only Grundy Park do. And a season is thirty-two
 * weeks of which only eighteen are league matches; the other fourteen are
 * cup rounds and free weeks, which belong to the week rather than to any
 * fixture and had nowhere to live at all.
 *
 * Safe to re-run. The week rows for the season are replaced wholesale, and
 * a fixture is only written when its date is actually wrong.
 */

type Row = Record<string, any>;

async function main(): Promise<void> {
  console.log("Importing the season calendar from hertsttl.org.uk\n");

  const calendars = await fetchSeasonCalendars();
  const [first] = calendars;
  if (!first) throw new Error("No calendars were read.");

  const seasonLabel = first.seasonLabel;
  if (!seasonLabel) {
    throw new Error("Could not read the season from the calendar pages.");
  }

  for (const calendar of calendars) {
    const counts = calendar.weeks.reduce<Record<string, number>>(
      (all, week) => ({ ...all, [week.kind]: (all[week.kind] ?? 0) + 1 }),
      {},
    );
    console.log(
      `  = ${calendar.division}: ${calendar.teams.length} teams, ${calendar.fixtures.length} fixtures, ` +
        `${counts.matches ?? 0} match weeks, ${counts.cup ?? 0} cup, ${counts.free ?? 0} free`,
    );
  }

  const client = await getSchemaClient();

  const seasons = (await client.request(
    readItems("hrc_seasons" as never, {
      fields: ["id", "label"],
      filter: { label: { _eq: seasonLabel } },
      limit: 1,
    } as never),
  )) as Row[];
  const season = seasons[0];
  if (!season) {
    throw new Error(
      `The calendar is for ${seasonLabel}, and there is no season with that label. ` +
        "Add it in Directus first.",
    );
  }

  // -- The weeks ----------------------------------------------------------
  //
  // All three divisions run the same programme — the same weeks are cup
  // weeks and the same weeks are free — so these are the season's weeks,
  // not a division's. A division that disagreed would mean a page had been
  // read against the wrong script, which is worth stopping for.

  const shapeOf = (index: number) =>
    calendars[index]!.weeks.map((week) => `${week.week}:${week.kind}:${week.label ?? ""}`).join(" ");
  for (let index = 1; index < calendars.length; index += 1) {
    if (shapeOf(index) !== shapeOf(0)) {
      throw new Error(
        `${calendars[index]!.division} has a different week shape from ${calendars[0]!.division}. ` +
          "Refusing to import a calendar that contradicts itself.",
      );
    }
  }

  const existingWeeks = (await client.request(
    readItems("hrc_calendar_weeks" as never, {
      fields: ["id"],
      filter: { season: { _eq: season.id } },
      limit: -1,
    } as never),
  )) as Row[];

  if (existingWeeks.length > 0) {
    await client.request(
      deleteItems("hrc_calendar_weeks" as never, existingWeeks.map((row) => row.id) as never),
    );
  }

  await client.request(
    createItems(
      "hrc_calendar_weeks" as never,
      first.weeks.map((week) => ({
        season: season.id,
        week_number: week.week,
        week_commencing: week.weekCommencing,
        kind: week.kind,
        label: week.label,
        note: null,
      })) as never,
    ),
  );
  console.log(`\n  = ${first.weeks.length} weeks written for ${season.label}`);

  // -- The dates ----------------------------------------------------------

  const fixtures = (await client.request(
    readItems("hrc_fixtures" as never, {
      fields: [
        "id",
        "week_commencing",
        "played_on",
        { home_team: ["name", "home_night"] },
        { away_team: ["name"] },
      ],
      filter: { _and: [{ season: { _eq: season.id } }, { competition: { _eq: "league" } }] },
      limit: -1,
    } as never),
  )) as Row[];

  // What the league's own tooltips say, for every fixture it draws.
  const published = new Map<string, string>();
  for (const calendar of calendars) {
    for (const fixture of calendar.fixtures) {
      published.set(
        fixtureKey(fixture.weekCommencing, fixture.homeTeam, fixture.awayTeam),
        fixture.playedOn,
      );
    }
  }

  let corrected = 0;
  let alreadyRight = 0;
  const undated: string[] = [];
  const notOnTheCalendar: string[] = [];

  for (const fixture of fixtures) {
    const home = fixture.home_team?.name as string | undefined;
    const away = fixture.away_team?.name as string | undefined;
    const week = fixture.week_commencing as string | null;
    if (!home || !away || !week) {
      undated.push(`${home ?? "?"} v ${away ?? "?"}`);
      continue;
    }

    const key = fixtureKey(week, home, away);
    // The league's published date first. Where it does not draw the fixture
    // — a team withdrawn from the grid but still in the results — the same
    // arithmetic off the team's own home night gives the same answer.
    const fromCalendar = published.get(key);
    if (!fromCalendar) notOnTheCalendar.push(`${home} v ${away}, w/c ${week}`);
    const played = fromCalendar ?? playedOnFrom(week, fixture.home_team?.home_night);

    if (!played) {
      undated.push(`${home} v ${away}, w/c ${week}`);
      continue;
    }
    if (played === fixture.played_on) {
      alreadyRight += 1;
      continue;
    }

    await client.request(
      updateItem("hrc_fixtures" as never, fixture.id as never, { played_on: played } as never),
    );
    corrected += 1;
  }

  console.log(
    `  = ${corrected} fixture dates corrected, ${alreadyRight} already right, ` +
      `of ${fixtures.length}`,
  );

  if (notOnTheCalendar.length > 0) {
    // Reported rather than dropped. The league blanks a withdrawn team out
    // of the grid without removing its results, and a fixture that exists
    // in one place and not the other is a thing for a person to look at,
    // not for a script to decide.
    console.log(`\n  ! not drawn on the league's calendar (${notOnTheCalendar.length}):`);
    for (const line of notOnTheCalendar) console.log(`      ${line}`);
  }
  if (undated.length > 0) {
    console.log(`\n  ! no date could be worked out (${undated.length}):`);
    for (const line of undated) console.log(`      ${line}`);
  }

  // The reverse direction: a fixture the league draws and we do not hold.
  const held = new Set(
    fixtures
      .filter((row) => row.home_team?.name && row.away_team?.name && row.week_commencing)
      .map((row) => fixtureKey(row.week_commencing, row.home_team.name, row.away_team.name)),
  );
  const missing = [...published.keys()].filter((key) => !held.has(key));
  if (missing.length > 0) {
    console.log(`\n  ! on the calendar but not held here (${missing.length}):`);
    for (const key of missing) console.log(`      ${key.split("|").join(" — ")}`);
  }

  console.log("\nCalendar import complete.");
}

main()
  .catch((error) => {
    const detail =
      (error as { errors?: { message?: string }[] })?.errors
        ?.map((item) => item.message)
        .filter(Boolean)
        .join("; ") ||
      (error as Error)?.message ||
      JSON.stringify(error);
    console.error(`\n${detail}\n`);
    process.exitCode = 1;
  })
  .finally(() => process.exit(process.exitCode ?? 0));
