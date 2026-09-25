import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { playedOnFrom } from "./calendar-source.js";
import { parseMatchHistory, parseSeasonLabel, type MatchRow } from "./parse-match-history.js";

/**
 * Imports the season's fixture programme from the league's own site.
 *
 * The league publishes it per team, at `MatchHistory.asp?Team=…`, which
 * means every match appears on two pages — once for the home side and once
 * for the away side. The same match must end up as one row here, so the
 * pages are read for every team and the results merged on what actually
 * identifies a match: the two teams and the week it is played in.
 *
 * Scores come across where the league has them. Most of a new season's
 * programme has none, which is the point: these are fixtures, and the
 * result is added when the card comes in.
 */

const BASE = "http://hertsttl.org.uk";

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

/**
 * One match, however many team pages it appeared on.
 *
 * Two teams and a week is enough: the league does not schedule the same
 * pairing twice in one week, and the reverse fixture is a different row
 * because the home team differs.
 */
function matchKey(row: Pick<MatchRow, "homeTeam" | "awayTeam" | "weekCommencing">): string {
  return `${row.weekCommencing}|${row.homeTeam}|${row.awayTeam}`;
}

async function main(): Promise<void> {
  console.log(`Importing the fixture programme from ${BASE}\n`);

  const client = await getSchemaClient();

  const teams = (await client.request(
    readItems("hrc_teams" as never, {
      fields: ["id", "name", "slug", "division", "home_night", { season: ["id", "label"] }],
      limit: -1,
    } as never),
  )) as Row[];

  if (teams.length === 0) {
    throw new Error("No teams found. Run `npm run import:league` first.");
  }

  const byName = new Map(teams.map((team) => [team.name as string, team]));

  // -- Read every team's page, merging the two views of each match --------

  const matches = new Map<string, MatchRow>();
  let seasonLabel: string | null = null;
  const unread: string[] = [];

  for (const team of teams) {
    const url = `${BASE}/MatchHistory.asp?Team=${encodeURIComponent(team.name)}`;
    let source: string;
    try {
      source = await fetchPage(url);
    } catch {
      unread.push(team.name);
      continue;
    }

    seasonLabel ??= parseSeasonLabel(source);
    const rows = parseMatchHistory(source);

    /*
     * A page that yields nothing is reported rather than passed over. An
     * empty parse looks exactly like a team with no fixtures, and quietly
     * importing an empty season is the failure this whole file is written
     * to avoid.
     */
    if (rows.length === 0) unread.push(team.name);

    for (const row of rows) {
      const key = matchKey(row);
      const existing = matches.get(key);
      // The two pages agree on everything but may not both carry the score;
      // whichever has it wins.
      if (!existing || (existing.homeScore === null && row.homeScore !== null)) {
        matches.set(key, row);
      }
    }
  }

  console.log(`  = read ${teams.length - unread.length}/${teams.length} team pages`);
  if (unread.length > 0) {
    console.log(`  ! nothing parsed for: ${unread.join(", ")}`);
  }

  // -- Resolve to the season and the teams we hold ------------------------

  if (!seasonLabel) throw new Error("Could not read the season from any team page.");

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
      `The league's programme is for ${seasonLabel}, and there is no season with that label. ` +
        "Add it in Directus first — inventing one here would hide a mismatch.",
    );
  }

  const rows: Row[] = [];
  const unknownTeams = new Set<string>();

  for (const match of matches.values()) {
    const home = byName.get(match.homeTeam);
    const away = byName.get(match.awayTeam);
    if (!home || !away) {
      // A team the site does not hold — recorded and skipped, never guessed
      // at, because a fixture against the wrong team is worse than none.
      if (!home) unknownTeams.add(match.homeTeam);
      if (!away) unknownTeams.add(match.awayTeam);
      continue;
    }

    const played = match.homeScore !== null && match.awayScore !== null;
    rows.push({
      season: season.id,
      competition: "league",
      home_team: home.id,
      away_team: away.id,
      week_commencing: match.weekCommencing,
      // The league schedules by week; the match falls on the *host's* own
      // night within it, which is Monday for exactly one club in twenty-six.
      // Writing the Monday into both fields — which this did until the
      // calendar import went in — puts every fixture on the wrong evening.
      // `import:calendar` then confirms these against the league's own
      // published dates.
      played_on: playedOnFrom(match.weekCommencing, home.home_night) ?? match.weekCommencing,
      status: played ? "played" : "scheduled",
      home_score: match.homeScore,
      away_score: match.awayScore,
      league_fixture_ref: `${season.label}:${matchKey(match)}`,
      last_synced_at: new Date().toISOString(),
    });
  }

  if (unknownTeams.size > 0) {
    console.log(`  ! teams not held here, fixtures skipped: ${[...unknownTeams].join(", ")}`);
  }

  // -- Bring this season's league fixtures up to date, in place --------------
  //
  // Scoped to the season and to league business, so a re-run cannot touch
  // another season's history or a cup tie entered by hand.
  //
  // In place, keyed on `league_fixture_ref`, rather than deleted and made
  // again. This used to clear the season and recreate it, which was fine
  // while there was nothing behind a fixture but a score. Once cards exist
  // it is a data-loss trap: every match's rubbers cascade away with it, a
  // card a captain typed in on this site goes with them, and every fixture
  // comes back with a new id — so every link to a match, and every "Enter
  // this result" shortcut, points at nothing. A routine refresh must not be
  // able to do that.

  const existing = (await client.request(
    readItems("hrc_fixtures" as never, {
      fields: [
        "id",
        "league_fixture_ref",
        "status",
        "home_score",
        "away_score",
        "week_commencing",
        "played_on",
        { home_team: ["id"] },
        { away_team: ["id"] },
      ],
      filter: { _and: [{ season: { _eq: season.id } }, { competition: { _eq: "league" } }] },
      limit: -1,
    } as never),
  )) as Row[];

  // Which fixtures have a card behind them. Their score and date are the
  // card's — from this site or from the league's own card — and the match
  // list's summary never overrides them.
  const carded = new Set(
    existing.length === 0
      ? []
      : (
          (await client.request(
            readItems("hrc_rubbers" as never, {
              fields: ["fixture"],
              filter: { fixture: { _in: existing.map((row) => row.id) } },
              limit: -1,
            } as never),
          )) as Row[]
        ).map((row) => String(row.fixture)),
  );

  const byRef = new Map(existing.map((row) => [row.league_fixture_ref as string, row]));
  const wanted = new Set(rows.map((row) => row.league_fixture_ref as string));
  const counts = { created: 0, updated: 0, unchanged: 0, removed: 0, voided: 0 };
  const disagreements: string[] = [];

  const toCreate: Row[] = [];
  for (const row of rows) {
    const held = byRef.get(row.league_fixture_ref as string);
    if (!held) {
      toCreate.push(row);
      continue;
    }

    const hasCard = carded.has(String(held.id));
    const patch: Row = {};
    if (held.home_team?.id !== row.home_team) patch.home_team = row.home_team;
    if (held.away_team?.id !== row.away_team) patch.away_team = row.away_team;
    if (held.week_commencing !== row.week_commencing) patch.week_commencing = row.week_commencing;

    if (hasCard) {
      // The card wins. Said out loud if the league's summary disagrees with
      // it, because that is a correction somebody needs to make somewhere.
      const leagueHas = row.home_score !== null && row.away_score !== null;
      if (leagueHas && (row.home_score !== held.home_score || row.away_score !== held.away_score)) {
        disagreements.push(
          `${row.league_fixture_ref}: card says ${held.home_score}-${held.away_score}, league list says ${row.home_score}-${row.away_score}`,
        );
      }
    } else {
      if (held.status !== row.status) patch.status = row.status;
      if (held.home_score !== row.home_score) patch.home_score = row.home_score;
      if (held.away_score !== row.away_score) patch.away_score = row.away_score;
      // An unplayed fixture's night follows the schedule; a played one's is
      // a fact, and the calendar import owns the scheduled dates anyway.
      if (held.status !== "played" && held.played_on !== row.played_on) patch.played_on = row.played_on;
    }

    if (Object.keys(patch).length === 0) {
      counts.unchanged += 1;
      continue;
    }
    patch.last_synced_at = row.last_synced_at;
    await client.request(updateItem("hrc_fixtures" as never, held.id, patch as never));
    counts.updated += 1;
  }

  for (let index = 0; index < toCreate.length; index += 100) {
    await client.request(createItems("hrc_fixtures" as never, toCreate.slice(index, index + 100) as never));
  }
  counts.created = toCreate.length;

  // Fixtures the league no longer lists — a team withdrawn, a match
  // struck off. Removed when there is nothing behind them; marked void
  // when there is a card, so the card and its link survive.
  const gone = existing.filter((row) => !wanted.has(row.league_fixture_ref as string));
  const removable = gone.filter((row) => !carded.has(String(row.id)));
  if (removable.length > 0) {
    await client.request(deleteItems("hrc_fixtures" as never, removable.map((row) => row.id) as never));
  }
  counts.removed = removable.length;
  for (const row of gone.filter((row) => carded.has(String(row.id)))) {
    await client.request(updateItem("hrc_fixtures" as never, row.id, { status: "void" } as never));
    counts.voided += 1;
  }

  const withScores = rows.filter((row) => row.status === "played").length;
  console.log(
    `\n  = ${rows.length} fixtures for ${season.label} ` +
      `(${withScores} played, ${rows.length - withScores} still to come)`,
  );
  console.log(
    `  = ${counts.created} added, ${counts.updated} updated, ${counts.unchanged} unchanged, ` +
      `${counts.removed} removed, ${counts.voided} voided — ${carded.size} card(s) left untouched`,
  );
  if (disagreements.length > 0) {
    console.log(`\n  ! the league's match list disagrees with a card (${disagreements.length}):`);
    for (const line of disagreements) console.log(`      ${line}`);
  }
  console.log("\nFixture import complete.");
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
