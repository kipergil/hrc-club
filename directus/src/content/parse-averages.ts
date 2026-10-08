import type { Division } from "../../../shared/enums.js";

/**
 * Reads the league's published averages and handicaps pages.
 *
 * `Averages{year}.htm` is a season's final averages: three tables side by
 * side, one per division, in the order the header row names them. Each
 * player row says more than it shows — the name cell's tooltip names the
 * club, the Played cell's says how many matches the player turned out in,
 * the % cell's how many their club's team played — and a player below the
 * league's 50%-of-matches rule is greyed out rather than left off.
 *
 * `Handicaps{year}.htm` lists every player's handicap, club by club.
 */

export interface AveragesRow {
  name: string;
  club: string;
  played: number;
  won: number;
  lost: number;
  winPercentage: number;
  /** Matches the player turned out in. */
  matchesPlayed: number | null;
  /** Matches their team played — what the 50% rule is measured against. */
  teamMatches: number | null;
  /** Not greyed out: met the 50% rule, so placed in the averages. */
  eligible: boolean;
}

export interface AveragesPage {
  /** "2025-26", from the page's own heading. Null if the page does not say. */
  seasonLabel: string | null;
  divisions: Array<{ division: Division; players: AveragesRow[] }>;
}

const DIVISION_NAMES: Record<string, Division> = {
  "premier division": "premier",
  "division one": "division_1",
  "division 1": "division_1",
  "division two": "division_2",
  "division 2": "division_2",
};

const strip = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/\s+/g, " ")
    .trim();

export function parseSeasonLabel(source: string): string | null {
  const match = /for the (\d{4})\s*-\s*(\d{2,4}) season/i.exec(strip(source));
  if (!match) return null;
  return `${match[1]}-${match[2]!.slice(-2)}`;
}

export function parseAveragesPage(source: string): AveragesPage {
  // The header row names the divisions, left to right.
  const headings = [...source.matchAll(/<font[^>]*size=4[^>]*>([^<]+)<\/font>/gi)]
    .map((match) => DIVISION_NAMES[strip(match[1]!).toLowerCase()])
    .filter((division): division is Division => Boolean(division));

  // The division tables are the bordered ones; the page's layout tables are not.
  const tables = source.split(/<table\b/i).slice(1);
  const playerTables = tables
    .map((table) => parsePlayerRows(table.split(/<\/table>/i)[0]!))
    .filter((rows) => rows.length > 0);

  if (playerTables.length !== headings.length) {
    throw new Error(
      `Found ${playerTables.length} division tables but ${headings.length} division headings — the page layout has changed.`,
    );
  }

  return {
    seasonLabel: parseSeasonLabel(source),
    divisions: playerTables.map((players, index) => ({ division: headings[index]!, players })),
  };
}

function parsePlayerRows(table: string): AveragesRow[] {
  const rows: AveragesRow[] = [];
  for (const row of table.split(/<\/tr>/i)) {
    const who = /title="([^"]+?) of ([^"]+?) club"/i.exec(row);
    if (!who) continue;
    const cells = [...row.matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map((cell) => strip(cell[1]!));
    const [, played, won, lost, percent] = cells;
    const numbers = [played, won, lost, percent].map((value) => Number.parseInt(value ?? "", 10));
    if (numbers.some((value) => Number.isNaN(value))) continue;
    const matches = /played in (\d+) match/i.exec(row);
    const team = /had (\d+) match/i.exec(row);
    rows.push({
      name: strip(who[1]!),
      club: strip(who[2]!),
      played: numbers[0]!,
      won: numbers[1]!,
      lost: numbers[2]!,
      winPercentage: numbers[3]!,
      matchesPlayed: matches ? Number(matches[1]) : null,
      teamMatches: team ? Number(team[1]) : null,
      eligible: !/color=gray/i.test(row),
    });
  }
  return rows;
}

/**
 * Every rated player's handicap, by name.
 *
 * 99 is the league's "not yet rated" and is left out. A name listed twice
 * with two different handicaps — two people of the same name at different
 * clubs — is left out too, since there is no telling which is which.
 */
export function parseHandicapsPage(source: string): { handicaps: Map<string, number>; ambiguous: string[] } {
  const seen = new Map<string, Set<number>>();
  for (const match of source.matchAll(/<td\b[^>]*\bnowrap\b[^>]*>([\s\S]*?)<\/td>\s*<td\b[^>]*>([\s\S]*?)<\/td>/gi)) {
    const name = strip(match[1]!);
    const value = Number.parseInt(strip(match[2]!), 10);
    if (!name || Number.isNaN(value) || value === 99) continue;
    const values = seen.get(name) ?? new Set<number>();
    values.add(value);
    seen.set(name, values);
  }
  const handicaps = new Map<string, number>();
  const ambiguous: string[] = [];
  for (const [name, values] of seen) {
    if (values.size === 1) handicaps.set(name, [...values][0]!);
    else ambiguous.push(name);
  }
  return { handicaps, ambiguous };
}
