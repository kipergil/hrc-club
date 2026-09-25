import { readItems } from "@directus/sdk";
import { getSchemaClient } from "../lib/client.js";
import { parseMatchHistory, parseSeasonLabel, type MatchRow } from "./parse-match-history.js";

/**
 * Reconciles this season's results against the league's own site.
 *
 * Read-only. It answers one question — does what we hold agree, match by
 * match, with what `MatchHistory.asp` says — and prints the rows where it
 * does not. Run it before an import to see what will change, and after
 * one to prove that nothing is left disagreeing.
 *
 * Worth having as its own script rather than as output from the importer,
 * because the interesting time to ask is when you are *not* importing:
 * results arrive on the league's site all season, entered by captains and
 * the match secretary, and the gap between the two sites is the thing
 * that needs watching.
 *
 *   npm run directus:compare:results
 *   npm run directus:compare:results -- --all   # every match, not only the gaps
 *   npm run directus:compare:results -- --json  # for a machine
 */

const BASE = "http://hertsttl.org.uk";

type Row = Record<string, any>;

/** One match as each side has it. `null` means nobody has entered a score. */
export interface Comparison {
  weekCommencing: string;
  homeTeam: string;
  awayTeam: string;
  league: { home: number; away: number } | null;
  ours: { home: number; away: number } | null;
  playedOn: string | null;
  verdict: "agree" | "differs" | "missing-here" | "only-here" | "neither-has-it";
}

function key(weekCommencing: string, homeTeam: string, awayTeam: string): string {
  return `${weekCommencing}|${homeTeam}|${awayTeam}`;
}

function scoreOf(home: unknown, away: unknown): { home: number; away: number } | null {
  return typeof home === "number" && typeof away === "number" ? { home, away } : null;
}

function same(a: Comparison["league"], b: Comparison["ours"]): boolean {
  if (a === null || b === null) return a === b;
  return a.home === b.home && a.away === b.away;
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

/**
 * Every match the league publishes, read from all 26 team pages.
 *
 * Each match appears on two of them — once for the home side and once for
 * the away — and the two views can disagree about the score, because a
 * page is generated when it is asked for and a card may have landed in
 * between. Whichever page carries a score wins; a page with none never
 * overwrites a page with one.
 */
export async function fetchLeagueResults(
  teamNames: string[],
  base = BASE,
): Promise<{ matches: Map<string, MatchRow>; seasonLabel: string | null; unread: string[] }> {
  const matches = new Map<string, MatchRow>();
  const unread: string[] = [];
  let seasonLabel: string | null = null;

  for (const name of teamNames) {
    let source: string;
    try {
      source = await fetchPage(`${base}/MatchHistory.asp?Team=${encodeURIComponent(name)}`);
    } catch {
      unread.push(name);
      continue;
    }

    seasonLabel ??= parseSeasonLabel(source);
    const rows = parseMatchHistory(source);
    if (rows.length === 0) unread.push(name);

    for (const row of rows) {
      const id = key(row.weekCommencing, row.homeTeam, row.awayTeam);
      const held = matches.get(id);
      if (!held || (held.homeScore === null && row.homeScore !== null)) matches.set(id, row);
    }
  }

  return { matches, seasonLabel, unread };
}

/** Joins the two sides on week-and-teams, which is what identifies a match. */
export function compare(
  league: Map<string, MatchRow>,
  ours: Row[],
): Comparison[] {
  const seen = new Set<string>();
  const out: Comparison[] = [];

  for (const row of ours) {
    const home = row.home_team?.name as string | undefined;
    const away = row.away_team?.name as string | undefined;
    const week = row.week_commencing as string | null;
    if (!home || !away || !week) continue;

    const id = key(week, home, away);
    seen.add(id);
    const theirs = league.get(id);
    const leagueScore = theirs ? scoreOf(theirs.homeScore, theirs.awayScore) : null;
    const ourScore = scoreOf(row.home_score, row.away_score);

    out.push({
      weekCommencing: week,
      homeTeam: home,
      awayTeam: away,
      league: leagueScore,
      ours: ourScore,
      playedOn: (row.played_on as string | null) ?? null,
      verdict: !theirs
        ? "only-here"
        : leagueScore === null && ourScore === null
          ? "neither-has-it"
          : same(leagueScore, ourScore)
            ? "agree"
            : leagueScore === null
              ? "only-here"
              : ourScore === null
                ? "missing-here"
                : "differs",
    });
  }

  // Anything the league draws that we do not hold at all.
  for (const [id, row] of league) {
    if (seen.has(id)) continue;
    out.push({
      weekCommencing: row.weekCommencing,
      homeTeam: row.homeTeam,
      awayTeam: row.awayTeam,
      league: scoreOf(row.homeScore, row.awayScore),
      ours: null,
      playedOn: null,
      verdict: "missing-here",
    });
  }

  return out.sort(
    (a, b) =>
      a.weekCommencing.localeCompare(b.weekCommencing) ||
      a.homeTeam.localeCompare(b.homeTeam),
  );
}

function show(score: Comparison["league"]): string {
  return score ? `${score.home}–${score.away}` : "—";
}

async function main(): Promise<void> {
  const showAll = process.argv.includes("--all");
  const asJson = process.argv.includes("--json");

  const client = await getSchemaClient();

  const teams = (await client.request(
    readItems("hrc_teams" as never, {
      fields: ["name", { season: ["label", "is_current"] }],
      limit: -1,
    } as never),
  )) as Row[];

  const current = teams.filter((team) => team.season?.is_current);
  if (current.length === 0) throw new Error("No teams in the current season.");
  const seasonLabel = current[0]!.season.label as string;

  if (!asJson) {
    console.log(`Reading ${current.length} team pages from ${BASE}…\n`);
  }

  const { matches, unread } = await fetchLeagueResults(
    current.map((team) => team.name as string),
  );

  const ours = (await client.request(
    readItems("hrc_fixtures" as never, {
      fields: [
        "week_commencing",
        "played_on",
        "home_score",
        "away_score",
        "status",
        { home_team: ["name"] },
        { away_team: ["name"] },
      ],
      filter: {
        _and: [{ season: { label: { _eq: seasonLabel } } }, { competition: { _eq: "league" } }],
      },
      limit: -1,
    } as never),
  )) as Row[];

  const rows = compare(matches, ours);

  if (asJson) {
    console.log(JSON.stringify({ seasonLabel, unread, rows }, null, 1));
    return;
  }

  const counts = rows.reduce<Record<string, number>>(
    (all, row) => ({ ...all, [row.verdict]: (all[row.verdict] ?? 0) + 1 }),
    {},
  );

  const shown = showAll ? rows : rows.filter((row) => row.verdict !== "neither-has-it");
  const width = Math.max(...shown.map((row) => row.homeTeam.length), 10);
  const awayWidth = Math.max(...shown.map((row) => row.awayTeam.length), 10);

  console.log(`${seasonLabel} — ${rows.length} matches\n`);
  console.log(
    `${"W/C".padEnd(11)} ${"Home".padEnd(width)} ${"Away".padEnd(awayWidth)} ${"League".padStart(7)} ${"Here".padStart(7)}  Verdict`,
  );
  for (const row of shown) {
    console.log(
      `${row.weekCommencing.padEnd(11)} ${row.homeTeam.padEnd(width)} ${row.awayTeam.padEnd(awayWidth)} ` +
        `${show(row.league).padStart(7)} ${show(row.ours).padStart(7)}  ${row.verdict}`,
    );
  }

  console.log("");
  for (const [verdict, count] of Object.entries(counts).sort()) {
    console.log(`  ${String(count).padStart(4)}  ${verdict}`);
  }
  if (unread.length > 0) {
    console.log(`\n  ! nothing parsed for: ${unread.join(", ")}`);
  }
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
