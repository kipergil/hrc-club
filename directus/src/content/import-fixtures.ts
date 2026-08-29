import { createItems, deleteItems, readItems } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
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
      fields: ["id", "name", "slug", "division", { season: ["id", "label"] }],
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
      // The league schedules by week and does not publish the night until
      // the captains agree it, so the week is all this can honestly say.
      played_on: match.weekCommencing,
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

  // -- Replace this season's league fixtures ------------------------------
  //
  // Scoped to the season and to league business, so a re-run cannot touch
  // another season's history or a cup tie entered by hand.

  const existing = (await client.request(
    readItems("hrc_fixtures" as never, {
      fields: ["id"],
      filter: { _and: [{ season: { _eq: season.id } }, { competition: { _eq: "league" } }] },
      limit: -1,
    } as never),
  )) as Row[];

  if (existing.length > 0) {
    await client.request(deleteItems("hrc_fixtures" as never, existing.map((r) => r.id) as never));
  }

  for (let index = 0; index < rows.length; index += 100) {
    await client.request(createItems("hrc_fixtures" as never, rows.slice(index, index + 100) as never));
  }

  const withScores = rows.filter((row) => row.status === "played").length;
  console.log(
    `\n  = ${rows.length} fixtures for ${season.label} ` +
      `(${withScores} played, ${rows.length - withScores} still to come)`,
  );
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
