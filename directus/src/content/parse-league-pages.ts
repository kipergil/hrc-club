/**
 * Parsers for the league's own pages — the home page, the Links page, the
 * seasonal Rolls of Honour and the Hall of Fame.
 *
 * Pure, like `parse-club-page.ts`, and for the same reason: this is
 * Microsoft FrontPage output from a site due to be replaced, so it needs
 * tests against captured copies rather than hope.
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

function strip(fragment: string): string {
  return decodeEntities(fragment.replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim();
}

/** Flattens a page to its visible lines, keeping cell and row boundaries. */
export function toLines(source: string): string[] {
  let body = source.replace(/<(script|style)[^>]*>.*?<\/\1>/gis, " ");
  // Collapse the source's own newlines first. The markup is hand-indented,
  // so a single table row spans several physical lines — splitting on those
  // later would cut every row into fragments and lose the rows entirely.
  body = body.replace(/\r?\n/g, " ");
  body = body.replace(/<\/t[dh]>/gi, " | ");
  body = body.replace(/<\/tr>|<br[^>]*>|<\/p>|<\/div>|<\/h\d>/gi, "\n");
  return decodeEntities(body.replace(/<[^>]+>/g, ""))
    .split("\n")
    .map((line) => line.replace(/[ \t ]+/g, " ").trim().replace(/^\|+|\|+$/g, "").trim())
    .filter((line) => line.length > 1);
}

export interface LeagueLink {
  label: string;
  url: string;
}

/** Every `<a href>` on a page, with its text. */
export function extractLinks(source: string): LeagueLink[] {
  const links: LeagueLink[] = [];
  for (const match of source.matchAll(/<a\s[^>]*href\s*=\s*["']([^"']+)["'][^>]*>(.*?)<\/a>/gis)) {
    const url = decodeEntities(match[1]!).trim();
    if (!url || /^(javascript:|#)/i.test(url)) continue;
    links.push({ label: strip(match[2]!), url });
  }
  return links;
}

// ---------------------------------------------------------------------------
// Home page
// ---------------------------------------------------------------------------

export interface HomePageInfo {
  /** The standing description of the league — who it is, since when, how big. */
  about: string | null;
  /** The banner at the top, e.g. the AGM date. Time-limited by nature. */
  announcement: string | null;
  /** The webmaster's seasonal note beneath it. */
  welcome: string | null;
  lastUpdated: string | null;
  committee: Array<{ name: string; role: string | null }>;
  documents: LeagueLink[];
  externalLinks: LeagueLink[];
}

/** Files the league offers for download, by extension. */
const DOCUMENT_PATTERN = /\.(pdf|docx?|xlsx?)$/i;

export function parseHomePage(source: string): HomePageInfo {
  const lines = toLines(source);

  const announcement = lines.find((line) => /^Coming up!/i.test(line)) ?? null;
  const welcome = lines.find((line) => /^Welcome to the .*Season/i.test(line)) ?? null;
  const lastUpdatedLine = lines.find((line) => /^Site last updated/i.test(line));
  const lastUpdated = lastUpdatedLine?.replace(/^Site last updated\s*/i, "").trim() || null;

  /*
   * The standing description runs from "Formed in <year>" to the committee
   * list. It does not begin its own line: the league's markup puts the
   * navigation and the description in one cell, so the paragraph starts
   * part-way through a line of 800-odd characters. Anchoring on the start of
   * a line finds nothing — and finding nothing here is silent, which is how
   * the league's description of itself went missing from the site once
   * already.
   */
  const committeeStart = lines.findIndex((line) => /contact any of our committee/i.test(line));
  const aboutStart = lines.findIndex((line) => /Formed in \d{4}/i.test(line));
  let about: string | null = null;
  if (aboutStart >= 0) {
    const offset = lines[aboutStart]!.search(/Formed in \d{4}/i);
    const first = lines[aboutStart]!.slice(offset).trim();
    const rest = lines.slice(
      aboutStart + 1,
      committeeStart > aboutStart ? committeeStart + 1 : aboutStart + 5,
    );
    // The source wraps its prose at arbitrary points, so one physical line
    // is not one paragraph — joining them all with blank lines would break
    // sentences in half ("…and is" / "quite probably the 13th oldest…").
    // A new paragraph starts only after a line that ends a sentence.
    const paragraphs: string[] = [];
    for (const line of [first, ...rest].filter(Boolean)) {
      const previous = paragraphs[paragraphs.length - 1];
      if (previous && !/[.!?:]$/.test(previous)) {
        paragraphs[paragraphs.length - 1] = `${previous} ${line}`;
      } else {
        paragraphs.push(line);
      }
    }
    about = paragraphs.join("\n\n");
  }

  // "Jo Swain - Chairperson", then bare names for members with no office.
  const committee: Array<{ name: string; role: string | null }> = [];
  if (committeeStart >= 0) {
    for (const line of lines.slice(committeeStart + 1)) {
      if (/^Players are requested/i.test(line) || /^Any views expressed/i.test(line)) break;
      const withRole = line.match(/^([A-Z][A-Za-z'’.\- ]+?)\s+-\s+(.+)$/);
      if (withRole) {
        committee.push({ name: withRole[1]!.trim(), role: withRole[2]!.trim() });
        continue;
      }
      // A bare name: two or three capitalised words and nothing else.
      if (/^[A-Z][A-Za-z'’.\-]+(?: [A-Z][A-Za-z'’.\-]+){1,2}$/.test(line)) {
        committee.push({ name: line.trim(), role: null });
      }
    }
  }

  const links = extractLinks(source);
  const documents = links.filter((link) => DOCUMENT_PATTERN.test(link.url));
  const externalLinks = links.filter((link) => /^https?:\/\//i.test(link.url));

  return { about, announcement, welcome, lastUpdated, committee, documents, externalLinks };
}

// ---------------------------------------------------------------------------
// Roll of Honour — one season, winners and runners-up
// ---------------------------------------------------------------------------

export interface RollOfHonourEntry {
  competition: string;
  winner: string;
  runnerUp: string | null;
}

export interface RollOfHonour {
  seasonLabel: string | null;
  entries: RollOfHonourEntry[];
}

export function parseRollOfHonour(source: string, fallbackSeason?: string): RollOfHonour {
  const lines = toLines(source);

  /*
   * The league's own link to the 2019-20 roll is dead, and IIS answers a
   * missing page with a *table* of diagnostics — "Module | IIS Web Core",
   * "Handler | StaticFile". Those parse as cleanly as real results, so
   * without this guard a broken link becomes eight fabricated honours
   * rather than an obvious gap. Recognising the page by its heading is the
   * cheapest way to tell a roll of honour from anything else that happens
   * to contain a table.
   */
  const heading = lines.find((line) => /Roll of Honour/i.test(line));
  if (!heading) return { seasonLabel: fallbackSeason ?? null, entries: [] };
  const seasonMatch =
    heading.match(/((?:19|20)\d{2}\s*[-/]\s*(?:\d{2}|\d{4}))/) ?? heading.match(/((?:19|20)\d{2})/);
  const seasonLabel = seasonMatch ? seasonMatch[1]!.replace(/\s+/g, "") : (fallbackSeason ?? null);

  const entries: RollOfHonourEntry[] = [];
  const headerIndex = lines.findIndex((line) => /^Competition\b/i.test(line));

  for (const line of lines.slice(headerIndex >= 0 ? headerIndex + 1 : 0)) {
    if (/^back to/i.test(line)) break;
    // Rows arrive as "Competition | Winner | Runner-Up", the last cell often
    // absent for individual awards.
    const cells = line.split("|").map((cell) => cell.trim()).filter(Boolean);
    if (cells.length < 2) continue;
    const [competition, winner, runnerUp] = cells;
    if (!competition || !winner) continue;
    if (/^winner$/i.test(winner)) continue;
    entries.push({ competition, winner, runnerUp: runnerUp ?? null });
  }

  return { seasonLabel, entries };
}

// ---------------------------------------------------------------------------
// Hall of Fame — every competition, back to 1970
// ---------------------------------------------------------------------------

export interface HallOfFameEntry {
  competition: string;
  year: number;
  winner: string;
}

/**
 * The Hall of Fame is laid out as one table per competition, with a column
 * per decade — so a single row holds 1972, 1982, 1992, 2002, 2012 and 2022
 * side by side. Reconstructing that grid is unnecessary: every cell is
 * self-describing ("1972 | MSD TTC"), so the year comes from the cell
 * rather than from its position, and the competition from the most recent
 * heading above it.
 */
export function parseHallOfFame(source: string): HallOfFameEntry[] {
  const lines = toLines(source);
  const entries: HallOfFameEntry[] = [];
  let competition: string | null = null;

  for (const line of lines) {
    // A competition's name sits in the first cell of its first row, so it
    // arrives on the same line as that row's data rather than on its own:
    // "Creasey Cup | 1970 | County Hall TTC | 1980 | …". Anything before the
    // first year is the heading.
    const firstYear = line.search(/\b(?:19|20)\d{2}\s*\|/);
    if (firstYear > 0) {
      const prefix = line.slice(0, firstYear).replace(/\|/g, " ").replace(/\s+/g, " ").trim();
      if (prefix && prefix.length < 60) competition = prefix;
    }

    const pairs = [...line.matchAll(/\b((?:19|20)\d{2})\s*\|\s*([^|]+?)\s*(?=\||$)/g)];

    if (pairs.length === 0) {
      // A line with no year pairs is either a heading or page furniture.
      if (
        line.length < 60 &&
        !/^back to|^Page last updated|Hall of Fame|Table Tennis League|^\.\.\.$/i.test(line)
      ) {
        competition = line.replace(/\s+/g, " ").trim();
      }
      continue;
    }

    if (!competition) continue;

    for (const pair of pairs) {
      const winner = pair[2]!.trim();
      // The league records a year it was not played rather than omitting it.
      if (!winner || /^no competition$/i.test(winner)) continue;
      entries.push({ competition, year: Number(pair[1]), winner });
    }
  }

  return entries;
}

/**
 * The league's team competitions, named explicitly.
 *
 * A pattern over the name does not work: "Pine Trophy" and "Wadesmill
 * Trophy" are individual awards while "MSD Trophy" is a team one, so
 * matching on "Trophy" mislabels them. Nor can it be inferred from the
 * winner — "Hoddesdon I" and "F. Burdett" are both plausible people until
 * you know which competition they won.
 *
 * A competition the league adds later falls through to "individual", which
 * is the safer default: it is the larger group, and the flag only affects
 * how an honour is grouped, never whether it is shown.
 */
const TEAM_COMPETITIONS = [
  /^premier division$/i,
  /^division \d$/i,
  /^creasey cup$/i,
  /^clifford troll trophy$/i,
  /^msd trophy$/i,
  /^hertford builders (cup|trophy)$/i,
];

export function isTeamCompetition(competition: string): boolean {
  return TEAM_COMPETITIONS.some((pattern) => pattern.test(competition.trim()));
}
