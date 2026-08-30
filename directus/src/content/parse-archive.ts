/**
 * Parser for the league's archived final tables — `Tables{year}.htm`.
 *
 * The league has quietly kept a static copy of every season's closing
 * tables since 2011-12, each one linking back to the season before it. It
 * is the only multi-season competitive record the old site holds, and it
 * is what makes a season filter worth having: without it there is one
 * season to filter by.
 *
 * Fourteen files, hand-built in FrontPage over fifteen years, so the
 * markup drifts: 2011-14 wrap every cell in a `<p>`, 2015 shouts team
 * names in capitals, 2016-18 ran two divisions rather than three, and
 * 2019-20 was abandoned mid-season and its table is a snapshot rather than
 * a result. What survives all of that is the shape of the table itself —
 * a division heading, a `Team / Played / Points` header, then rows — so
 * the parser anchors on the header row and reads outwards from it.
 *
 * Pure and tested against captured copies, for the reason the other
 * parsers here are: the failure that costs most is not an exception, it is
 * a table that comes back with one row instead of eight and looks fine.
 */

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

/**
 * Flattens the page to one line per table row, cells separated by `|`.
 *
 * Unlike `toLines` in `parse-league-pages.ts` this does **not** break a
 * line on `</p>`. The 2011-14 files write every cell as
 * `<td><p> 18 </p></td>`, and treating that close tag as a line break cuts
 * each row into three fragments — which reads as a table with no rows at
 * all rather than as an error. Nothing on these pages needs paragraphs to
 * survive: the only thing being read is tables.
 */
function toRowLines(source: string): string[] {
  let body = source.replace(/<(script|style)[^>]*>.*?<\/\1>/gis, " ");
  body = body.replace(/<\/?p\b[^>]*>/gi, " ");
  body = body.replace(/\r?\n/g, " ");
  body = body.replace(/<\/t[dh]>/gi, " | ");
  body = body.replace(/<\/tr>|<br[^>]*>|<\/div>|<\/h\d>/gi, "\n");
  return decodeEntities(body.replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim())
    .filter((line) => line.length > 1);
}

/** The cells of a flattened row, with trailing empty ones dropped. */
function cellsOf(line: string): string[] {
  const cells = line.split("|").map((cell) => cell.trim());
  while (cells.length > 0 && cells[cells.length - 1] === "") cells.pop();
  while (cells.length > 0 && cells[0] === "") cells.shift();
  return cells;
}

export interface ArchivedStanding {
  teamName: string;
  played: number;
  points: number;
}

export interface ArchivedDivision {
  /** `premier` | `division_one` | `division_two`, matching `DIVISION`. */
  division: string;
  rows: ArchivedStanding[];
}

export interface ArchivedSeason {
  /** e.g. "2025-26", derived from the page's own wording where it says so. */
  label: string | null;
  /**
   * Set when the league says the season did not finish. 2019-20 was
   * abandoned in March 2020 and 2020-21 never started; both are part of
   * the record and neither should be presented as a final table.
   */
  incomplete: "abandoned" | "cancelled" | null;
  divisions: ArchivedDivision[];
}

const HEADER = /^team\s*\|\s*played\s*\|\s*points$/i;

/**
 * Maps the division as the page happens to name it that year.
 *
 * The wording moved from "Division 1" to "Division One" around 2018 and
 * the older files trail the heading with an ellipsis, so this matches on
 * the number or the word rather than on the whole string.
 */
function divisionOf(heading: string): string | null {
  const text = heading.toLowerCase();
  if (/premier/.test(text)) return "premier";
  if (/division\s*(one|1)\b/.test(text)) return "division_one";
  if (/division\s*(two|2)\b/.test(text)) return "division_two";
  return null;
}

/**
 * The season the page is for, as this site labels seasons.
 *
 * Taken from the page's own prose where it states both years — "at the end
 * of the 2025 - 2026 season" — because the file name only carries the
 * first of them and a season that starts in 2025 is `2025-26` here.
 */
export function parseArchiveSeasonLabel(source: string, fallbackYear?: number): string | null {
  const stated = source.match(/\b(20\d{2})\s*[-–/]\s*(20\d{2}|\d{2})\b/);
  if (stated) {
    const start = Number(stated[1]);
    return `${start}-${String((start + 1) % 100).padStart(2, "0")}`;
  }
  if (fallbackYear === undefined) return null;
  return `${fallbackYear}-${String((fallbackYear + 1) % 100).padStart(2, "0")}`;
}

function incompleteOf(source: string): ArchivedSeason["incomplete"] {
  // 2020-21 says so in prose; 2019-20 says it with a background image
  // stamped "abandoned" across the tables and nothing in the text.
  if (/cancelled due to covid|had to be cancelled/i.test(source)) return "cancelled";
  if (/abandoned/i.test(source)) return "abandoned";
  return null;
}

/**
 * Every division table on an archived tables page.
 *
 * Anchored on the `Team | Played | Points` header row: the division
 * heading above it is markup that changed four times in fifteen years
 * (`<h3>`, a `<font size=4>` in a spanning cell, a bare row), but it is
 * always the nearest short line above the header that names a division,
 * and the data rows are always immediately below it.
 */
export function parseFinalTables(source: string): ArchivedDivision[] {
  const lines = toRowLines(source);
  const divisions: ArchivedDivision[] = [];

  for (const [index, line] of lines.entries()) {
    if (!HEADER.test(cellsOf(line).join(" | "))) continue;

    // Backwards, nearest first. A window of four is enough for every year
    // and short enough not to reach the previous division's last team.
    let division: string | null = null;
    for (let back = index - 1; back >= Math.max(0, index - 4); back -= 1) {
      const heading = lines[back]!;
      if (heading.length > 40) continue;
      division = divisionOf(heading);
      if (division) break;
    }
    if (!division) continue;

    const rows: ArchivedStanding[] = [];
    for (const candidate of lines.slice(index + 1)) {
      const cells = cellsOf(candidate);
      if (cells.length !== 3) break;
      const played = Number(cells[1]);
      const points = Number(cells[2]);
      if (!Number.isInteger(played) || !Number.isInteger(points)) break;
      if (!cells[0]) break;
      rows.push({ teamName: tidyTeamName(cells[0]!), played, points });
    }

    if (rows.length > 0) divisions.push({ division, rows });
  }

  return divisions;
}

/**
 * The 2015 file writes every team in capitals, so names are normalised to
 * the league's own casing before they are matched against the teams this
 * site holds.
 *
 * Word by word rather than name by name, because "HRC A" is entirely
 * capitals and entirely correct. What separates it from "ALLENBURYS 1" is
 * length: the league's acronyms are three letters or fewer (HRC, MSD) and
 * its shouted words are four or more, so only the long ones are calmed
 * down. Team letters and numbers pass through untouched at either length.
 */
export function tidyTeamName(raw: string): string {
  return raw
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .map((word) => {
      if (word.length < 4) return word;
      if (word !== word.toUpperCase()) return word;
      return word.charAt(0) + word.slice(1).toLowerCase();
    })
    .join(" ");
}

export function parseArchivedSeason(source: string, fallbackYear?: number): ArchivedSeason {
  return {
    label: parseArchiveSeasonLabel(source, fallbackYear),
    incomplete: incompleteOf(source),
    divisions: parseFinalTables(source),
  };
}
