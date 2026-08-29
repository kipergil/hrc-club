/**
 * Parser for the league's per-team match list, `MatchHistory.asp?Team=…`.
 *
 * Pure, and tested against a captured copy, for the same reason as the
 * other parsers here: this is Classic ASP output from a site due to be
 * switched off, and the failure that costs most is not an error but a
 * silent empty result.
 */

/**
 * Cell separator for the flattened row.
 *
 * Built with `fromCharCode` rather than written into the source, both
 * because a literal control character is invisible in a diff and because
 * an editor or a scripted edit will happily mangle one. It only has to be
 * something the league's own text cannot contain.
 */
const CELL = String.fromCharCode(1);

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)));
}

export interface MatchRow {
  /** The Monday the league schedules the match in, as an ISO date. */
  weekCommencing: string;
  homeTeam: string;
  awayTeam: string;
  /** Rubbers won, or null where the card has not come in. */
  homeScore: number | null;
  awayScore: number | null;
}

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6,
  jul: 7, aug: 8, sep: 9, oct: 10, nov: 11, dec: 12,
};

/** "21 Sep 2026" → "2026-09-21". */
export function toIsoDate(text: string): string | null {
  const match = text.trim().match(/^(\d{1,2})\s+([A-Za-z]{3,})\s+(\d{4})$/);
  if (!match) return null;
  const month = MONTHS[match[2]!.slice(0, 3).toLowerCase()];
  if (!month) return null;
  return `${match[3]}-${String(month).padStart(2, "0")}-${match[1]!.padStart(2, "0")}`;
}

/**
 * Rows arrive as `marker | W/C date | home | home score | spacer | away |
 * away score`.
 *
 * Two things about that shape are easy to get wrong. The row opens with a
 * marker cell — a blinking red flag the league uses for rearranged matches
 * — which is empty on most rows, so counting columns from the left reads a
 * different field depending on the row; the date is found first and the
 * rest taken relative to it. And the spacer between the two halves is an
 * empty cell that must be kept: dropping empty cells to tidy the row moves
 * the away team into the score column, which parses cleanly and is
 * completely wrong. That exact mistake cost a day on the club squad parser.
 */
export function parseMatchHistory(source: string): MatchRow[] {
  let body = source.replace(/<(script|style)[^>]*>.*?<\/\1>/gis, " ");
  body = body.replace(/\r?\n/g, " ");
  body = body.replace(/<\/t[dh]>/gi, CELL);
  body = body.replace(/<\/tr>/gi, "\n");
  const text = decodeEntities(body.replace(/<[^>]+>/g, ""));

  const rows: MatchRow[] = [];
  for (const line of text.split("\n")) {
    const cells = line.split(CELL).map((cell) => cell.replace(/\s+/g, " ").trim());
    if (cells.length < 6) continue;

    const dateIndex = cells.findIndex((cell) => toIsoDate(cell) !== null);
    if (dateIndex === -1) continue;

    const weekCommencing = toIsoDate(cells[dateIndex]!)!;
    const homeTeam = cells[dateIndex + 1] ?? "";
    const homeScore = cells[dateIndex + 2] ?? "";
    const awayTeam = cells[dateIndex + 4] ?? "";
    const awayScore = cells[dateIndex + 5] ?? "";
    if (!homeTeam || !awayTeam) continue;

    rows.push({
      weekCommencing,
      homeTeam,
      awayTeam,
      homeScore: /^\d+$/.test(homeScore) ? Number(homeScore) : null,
      awayScore: /^\d+$/.test(awayScore) ? Number(awayScore) : null,
    });
  }

  return rows;
}

/** The season the page is for, e.g. "2026-2027" → "2026-27". */
export function parseSeasonLabel(source: string): string | null {
  const match = source.match(/(\d{4})\s*-\s*(\d{4})\s*Season/i);
  if (!match) return null;
  return `${match[1]}-${match[2]!.slice(2)}`;
}
