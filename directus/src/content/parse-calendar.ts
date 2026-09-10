/**
 * Parser for the league's season calendar — `Calendar0.htm`, `Calendar1.htm`,
 * `Calendar2.htm`, one per division, plus the `CalendarJ*.js` beside each.
 *
 * The interesting part of these pages is not in the HTML. Each grid cell
 * carries an `ONMOUSEOVER` handler — `Match('A','I','a','3','0','0')` — and
 * the tooltip that handler builds is where the league states the date a
 * match is actually played on. The page itself only ever shows the Monday
 * the week commences, which is almost never the night anybody plays: the
 * league schedules a week, and the match falls on the *host club's* own
 * night within it. Cheshunt play Tuesdays, Ellenborough Fridays, so the
 * same column of the same grid is three days apart from one row to the next.
 *
 * That arithmetic lives in the JavaScript file, and so do the season's start
 * date, the team names behind the letters `A`–`J`, and each team's home
 * night. All four are declared as `var` arrays inside a function, which is
 * why this parses the JS as text rather than running it — running it would
 * mean giving the league's site a shell, and the declarations are stable
 * enough (they are edited by hand once a season, under a comment that says
 * so) to read directly.
 *
 * Pure and tested against captured copies, like the other parsers here.
 */

/** A week of the season, and what the league has it down for. */
export interface CalendarWeek {
  /** 1 for the first week of the season. */
  week: number;
  /** The Monday, as an ISO date. */
  weekCommencing: string;
  kind: "matches" | "cup" | "free";
  /**
   * What the league calls it — "Divisional", "Handicap", "Finals" for a cup
   * week; "Free", "Christmas", "Easter" for a break. Null for a normal week.
   */
  label: string | null;
}

/** One scheduled match, with both of its dates. */
export interface CalendarFixture {
  week: number;
  /** The Monday the league schedules it in. */
  weekCommencing: string;
  /** The night it is actually played: the Monday plus the host's home night. */
  playedOn: string;
  homeTeam: string;
  awayTeam: string;
}

export interface SeasonCalendar {
  /** "2026-27", taken from the page's own heading. */
  seasonLabel: string | null;
  /** The Monday the season starts, as an ISO date. */
  seasonStart: string;
  /** Team names in grid order, excluding the league's "No Match" padding. */
  teams: string[];
  /** Team name to the day of the week it plays at home, 1 = Monday. */
  homeNights: Record<string, number>;
  weeks: CalendarWeek[];
  fixtures: CalendarFixture[];
}

const MONTHS: Record<string, number> = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

/**
 * The league's padding for an odd number of teams.
 *
 * Its own JavaScript warns "No Match spelling is important!", because the
 * tooltip branches on it. A row against one of these is a bye, not a fixture.
 */
const NO_MATCH = "No Match";

function decodeEntities(text: string): string {
  return text
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&#(\d+);/g, (_m, code: string) => String.fromCodePoint(Number(code)));
}

/** `new Array("a","b")` → `["a","b"]`, for the one named `var` in the file. */
function jsArray(source: string, name: string): string[] | null {
  const declaration = new RegExp(`var\\s+${name}\\s*=\\s*new\\s+Array\\s*\\(([^)]*)\\)`, "i");
  const found = source.match(declaration);
  if (!found) return null;
  return [...found[1]!.matchAll(/"([^"]*)"/g)].map((m) => m[1]!);
}

/** `new Date("14 September 2026 01:00:00")` → "2026-09-14". */
function seasonStartOf(source: string): string | null {
  const found = source.match(/var\s+dStartOfSeason\s*=\s*new\s+Date\s*\(\s*"([^"]+)"/i);
  if (!found) return null;
  const parts = found[1]!.trim().match(/^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})/);
  if (!parts) return null;
  const month = MONTHS[parts[2]!.toLowerCase()];
  if (!month) return null;
  return `${parts[3]}-${String(month).padStart(2, "0")}-${parts[1]!.padStart(2, "0")}`;
}

/** Days added to an ISO date, without ever going near a local timezone. */
export function addDays(iso: string, days: number): string {
  const at = Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  );
  return new Date(at + days * 86_400_000).toISOString().slice(0, 10);
}

/**
 * One `ONMOUSEOVER` handler, unpacked.
 *
 * The three the league uses are `Match(a, b, hoa, wk, …)`, `Cup(a, b, wk, …,
 * cup)` and `Break(a, b, wk, …, holiday)` — note that the week is the
 * *fourth* argument of one and the *third* of the other two, which is the
 * kind of difference that reads as a typo and is not.
 */
interface Handler {
  fn: string;
  args: string[];
}

function handlersOf(cell: string): Handler[] {
  const calls = cell.matchAll(/(Match|Cup|Break)\s*\(([^)]*)\)/g);
  return [...calls].map((call) => ({
    fn: call[1]!,
    args: [...call[2]!.matchAll(/'([^']*)'/g)].map((m) => m[1]!),
  }));
}

/**
 * Reads one division's calendar.
 *
 * `html` is the page; `js` is the `CalendarJ*.js` it loads. Both are needed:
 * the page says which cell is which, and the script says what the cells mean.
 */
export function parseCalendar(html: string, js: string): SeasonCalendar {
  const seasonStart = seasonStartOf(js);
  if (!seasonStart) {
    throw new Error("Could not find dStartOfSeason in the calendar script");
  }

  const names = jsArray(js, "aTeam");
  const nights = jsArray(js, "aHomeNight");
  const indexes = jsArray(js, "aIndex") ?? ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J"];
  if (!names || !nights) {
    throw new Error("Could not find aTeam / aHomeNight in the calendar script");
  }

  // Letter to team, and team to the day it plays at home. The league counts
  // days from Monday as 0; every other date in this project counts from
  // Monday as 1, so the offset is kept raw here and named `offset`.
  const teamOf = new Map<string, string>();
  const offsetOf = new Map<string, number>();
  for (const [i, letter] of indexes.entries()) {
    const name = names[i];
    if (!name || name === NO_MATCH) continue;
    teamOf.set(letter, name);
    offsetOf.set(name, Number(nights[i] ?? 0));
  }

  const seasonLabel =
    html.match(/class="?Season"?\s*>\s*([0-9]{4}-[0-9]{2})/i)?.[1] ??
    html.match(/([0-9]{4}-[0-9]{2})\s+Season/i)?.[1] ??
    null;

  // -- Walk every cell of both grids ------------------------------------
  //
  // Rows are read whole rather than by column position: the two grids are
  // sixteen weeks each and a division with an odd number of teams gets a
  // padding row, so counting columns from the left is one schema change
  // away from being silently wrong. The week number is inside the handler.
  const weekKinds = new Map<number, { kind: CalendarWeek["kind"]; label: string | null }>();
  const fixtures = new Map<string, CalendarFixture>();

  for (const row of html.split(/<tr\b/i).slice(1)) {
    for (const cell of row.split(/<td\b/i).slice(1)) {
      for (const { fn, args } of handlersOf(cell)) {
        if (fn === "Match") {
          const [a, b, hoa, week] = args;
          const own = teamOf.get(a ?? "");
          const other = teamOf.get(b ?? "");
          const number = Number(week);
          if (!own || !other || !Number.isFinite(number)) continue;

          // `a` is always the row's own team, whichever end of the fixture
          // it is; `hoa` says which. Reading `a` as the home team makes
          // every away row claim a fixture against itself.
          const homeTeam = hoa === "h" ? own : other;
          const awayTeam = hoa === "h" ? other : own;

          const weekCommencing = addDays(seasonStart, (number - 1) * 7);
          const playedOn = addDays(weekCommencing, offsetOf.get(homeTeam) ?? 0);
          // Each match appears twice, once on each team's row. Keyed on
          // what identifies it so the second sighting is the same row.
          fixtures.set(`${number}|${homeTeam}|${awayTeam}`, {
            week: number,
            weekCommencing,
            playedOn,
            homeTeam,
            awayTeam,
          });
          weekKinds.set(number, { kind: "matches", label: null });
        } else if (fn === "Cup" || fn === "Break") {
          const number = Number(args[2]);
          if (!Number.isFinite(number)) continue;
          const raw = decodeEntities(args[args.length - 1] ?? "").trim();
          const label = raw && raw !== "Free" ? raw : fn === "Break" ? "Free" : null;
          // A week with any match in it is a match week: the league marks
          // a bye row `Break(...)` alongside the rows that are playing.
          if (weekKinds.get(number)?.kind === "matches") continue;
          weekKinds.set(number, { kind: fn === "Cup" ? "cup" : "free", label });
        }
      }
    }
  }

  const weeks: CalendarWeek[] = [...weekKinds.entries()]
    .sort(([a], [b]) => a - b)
    .map(([week, { kind, label }]) => ({
      week,
      weekCommencing: addDays(seasonStart, (week - 1) * 7),
      kind,
      label,
    }));

  return {
    seasonLabel,
    seasonStart,
    teams: [...offsetOf.keys()],
    homeNights: Object.fromEntries([...offsetOf].map(([name, day]) => [name, day + 1])),
    weeks,
    fixtures: [...fixtures.values()].sort(
      (a, b) =>
        a.week - b.week || a.homeTeam.localeCompare(b.homeTeam) || a.awayTeam.localeCompare(b.awayTeam),
    ),
  };
}
