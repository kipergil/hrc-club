import { createItems, deleteItems, readItems, updateItem } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { parseArchivedSeason, type ArchivedSeason } from "./parse-archive.js";

/**
 * Imports the league's archived closing tables — `Tables{year}.htm`.
 *
 * The league has kept a static copy of every season's final tables since
 * 2011-12, each linking back to the one before it. It is the only
 * multi-season competitive record the old site holds, and importing it is
 * what turns a season filter from a control with one option into fifteen
 * years of league history.
 *
 * Two seasons in that range were not played to a finish, and both are
 * imported rather than skipped: leaving them out would make the archive
 * read as continuous, which is a claim about the league's history that
 * happens not to be true. 2019-20 is marked abandoned, 2020-21 cancelled.
 *
 * Idempotent. Standings for a season are replaced wholesale on each run,
 * because a partial update would leave a team that has since been renamed
 * sitting in the table twice.
 */

const BASE = "http://hertsttl.org.uk";

/**
 * The seasons the league publishes, oldest first.
 *
 * Written out rather than discovered by following each page's "last
 * season" link, because the chain has gaps — 2020-21 links nowhere — and a
 * crawler that stops at the first gap silently imports half the archive.
 * A fixed list makes a missing year an error instead.
 */
const ARCHIVE_YEARS = [
  2011, 2012, 2013, 2014, 2015, 2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025,
] as const;

/**
 * How many division tables each season should yield.
 *
 * The league ran two divisions from 2016-17 to 2018-19 and three either
 * side of that; 2020-21 was never played. Asserting the count per year is
 * the only defence against the failure that matters here — a parser that
 * returns four rows instead of eight and looks entirely healthy.
 */
const EXPECTED_DIVISIONS: Record<number, number> = {
  2011: 3, 2012: 3, 2013: 3, 2014: 3, 2015: 3,
  2016: 2, 2017: 2, 2018: 2,
  2019: 3, 2020: 0, 2021: 3, 2022: 3, 2023: 3, 2024: 3, 2025: 3,
};

type Row = Record<string, any>;
type Client = Awaited<ReturnType<typeof getSchemaClient>>;

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

/**
 * Restores a club's own spelling of its name.
 *
 * The archive is inconsistent about it across fifteen years, and so, in
 * one direction, is `tidyTeamName`: it has to lower-case shouted words to
 * make the 2015 page readable, and that turns "PRAMASTARS 1" into
 * "Pramastars 1" while the years either side write "PramaStars 1". The
 * result is one club filed under two names in the archive.
 *
 * The clubs this site holds are the authority on their own capitalisation,
 * so a team name that starts with a known club's name takes that club's
 * casing. Anything else — the folded clubs, Allenburys and Hoddesdon and
 * County Hall — is left exactly as the league wrote it, because there is
 * nothing left to check it against and inventing a spelling would be worse
 * than keeping theirs.
 */
function canonicaliseClubPrefix(name: string, clubNames: string[]): string {
  const lower = name.toLowerCase();
  for (const club of clubNames) {
    const prefix = club.toLowerCase();
    if (lower === prefix) return club;
    if (lower.startsWith(`${prefix} `)) return club + name.slice(club.length);
  }
  return name;
}

/**
 * Match an archived team name to a team this site holds.
 *
 * Deliberately exact. The names drift across fifteen years — "Grundy Park
 * 1" becomes "Grundy Park A", "Hoddesdon" and "Allenburys" and "County
 * Hall" stop existing altogether — and guessing at the mapping would put
 * one club's history under another club's name. An unmatched row keeps its
 * name as text and links nowhere, which `hrc_standings.team_name` exists
 * for and which the table already handles.
 */
function teamIdFor(byName: Map<string, Row>, name: string): string | null {
  return (byName.get(name)?.id as string | undefined) ?? null;
}

async function seasonFor(client: Client, label: string): Promise<Row> {
  const existing = (await client.request(
    readItems("hrc_seasons" as never, {
      fields: ["id", "label", "slug", "completion"],
      filter: { label: { _eq: label } },
      limit: 1,
    } as never),
  )) as Row[];
  if (existing[0]) return existing[0];

  const startYear = Number(label.slice(0, 4));
  const [created] = (await client.request(
    createItems("hrc_seasons" as never, [
      {
        label,
        slug: label,
        starts_on: `${startYear}-09-01`,
        ends_on: `${startYear + 1}-04-30`,
        is_current: false,
        completion: "completed",
      },
    ] as never),
  )) as unknown as Row[];
  return created!;
}

async function replaceStandings(client: Client, seasonId: string, rows: Row[]): Promise<void> {
  const existing = (await client.request(
    readItems("hrc_standings" as never, {
      fields: ["id"],
      filter: { season: { _eq: seasonId } },
      limit: -1,
    } as never),
  )) as Row[];

  if (existing.length > 0) {
    await client.request(deleteItems("hrc_standings" as never, existing.map((row) => row.id)));
  }
  if (rows.length > 0) {
    await client.request(createItems("hrc_standings" as never, rows as never));
  }
}

async function main(): Promise<void> {
  console.log(`Importing the archived league tables from ${BASE}\n`);

  const client = await getSchemaClient();

  const teams = (await client.request(
    readItems("hrc_teams" as never, { fields: ["id", "name"], limit: -1 } as never),
  )) as Row[];
  if (teams.length === 0) {
    throw new Error("No teams found. Run `npm run import:league` first.");
  }
  const byName = new Map(teams.map((team) => [team.name as string, team]));

  const clubs = (await client.request(
    readItems("hrc_clubs" as never, { fields: ["name", "is_home_club"], limit: -1 } as never),
  )) as Row[];
  const homeClubName = clubs.find((club) => club.is_home_club)?.name as string | undefined;
  // Longest first, so "Stanstead Abbotts" is tried before a club whose
  // name is a prefix of it would be.
  const clubNames = clubs
    .map((club) => club.name as string)
    .sort((a, b) => b.length - a.length);

  const problems: string[] = [];
  const unmatched = new Set<string>();
  let seasonsWritten = 0;
  let rowsWritten = 0;

  for (const year of ARCHIVE_YEARS) {
    const url = `${BASE}/Tables${year}.htm`;

    let parsed: ArchivedSeason;
    try {
      parsed = parseArchivedSeason(await fetchPage(url), year);
    } catch (error) {
      problems.push(`${year}: ${(error as Error).message}`);
      continue;
    }

    const expected = EXPECTED_DIVISIONS[year];
    if (expected !== undefined && parsed.divisions.length !== expected) {
      // Loud, and skipped. Writing a season that came back short would
      // put a half-table into the archive and nothing would ever say so.
      problems.push(
        `${year}: parsed ${parsed.divisions.length} division tables, expected ${expected} — not imported`,
      );
      continue;
    }

    const label = parsed.label;
    if (!label) {
      problems.push(`${year}: could not work out which season this page is for — not imported`);
      continue;
    }

    const season = await seasonFor(client, label);

    // The season row may predate this import, so its completion is set
    // every run rather than only at creation.
    const completion = parsed.incomplete ?? "completed";
    if (season.completion !== completion) {
      await client.request(updateItem("hrc_seasons" as never, season.id, { completion } as never));
    }

    const rows: Row[] = [];
    for (const division of parsed.divisions) {
      division.rows.forEach((row, index) => {
        const teamName = canonicaliseClubPrefix(row.teamName, clubNames);
        const teamId = teamIdFor(byName, teamName);
        if (!teamId) unmatched.add(teamName);
        rows.push({
          season: season.id,
          division: division.division,
          // The order on the page is the order the league placed them,
          // rule 20 already applied. Re-sorting on points here would undo
          // the league's own tie-break with a worse one.
          position: index + 1,
          team: teamId,
          team_name: teamName,
          is_hrc: homeClubName ? teamName.startsWith(homeClubName) : false,
          played: row.played,
          points: row.points,
          // Left null on purpose — see the note on the collection. The
          // league's closing tables carry played and points only.
          won: null,
          drawn: null,
          lost: null,
          sets_for: null,
          sets_against: null,
          last_synced_at: new Date().toISOString(),
        });
      });
    }

    await replaceStandings(client, season.id, rows);
    seasonsWritten += 1;
    rowsWritten += rows.length;

    const note = parsed.incomplete ? ` (${parsed.incomplete})` : "";
    console.log(
      `  = ${label}${note}: ${parsed.divisions.length} divisions, ${rows.length} teams`,
    );
  }

  console.log(`\n  ${seasonsWritten} seasons, ${rowsWritten} table rows.`);

  if (unmatched.size > 0) {
    // Expected, not a failure: clubs fold. These rows keep their name and
    // simply do not link to a team page.
    console.log(
      `\n  ${unmatched.size} team names have no team record here, so their rows do not link:\n` +
        `    ${[...unmatched].sort().join(", ")}`,
    );
  }

  if (problems.length > 0) {
    console.log("\n  ! problems:");
    for (const problem of problems) console.log(`    ${problem}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
