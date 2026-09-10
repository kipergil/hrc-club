import { parseCalendar, type SeasonCalendar } from "./parse-calendar.js";

/**
 * Fetches the league's season calendar — one page per division.
 *
 * Kept apart from both importers because both need it: the calendar is
 * where the real match dates live, so the fixture import would otherwise
 * carry on writing the Monday of the week into `played_on` and quietly
 * disagree with the calendar import that runs after it.
 */

const BASE = "http://hertsttl.org.uk";

/**
 * The league's own division order, and the file each one lives in.
 * `Calendar0.htm` is the Premier, and the JavaScript beside it is
 * `CalendarJ0.js` — the pairing is positional, not named.
 */
const DIVISIONS = [
  { division: "premier", page: "Calendar0.htm", script: "CalendarJ0.js" },
  { division: "division_1", page: "Calendar1.htm", script: "CalendarJ1.js" },
  { division: "division_2", page: "Calendar2.htm", script: "CalendarJ2.js" },
] as const;

export interface DivisionCalendar extends SeasonCalendar {
  division: (typeof DIVISIONS)[number]["division"];
}

async function fetchPage(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url} returned HTTP ${response.status}`);
  // Windows-1252, like the rest of that site. Read as UTF-8 the team names
  // come back subtly wrong and then fail to match a row in Directus.
  return new TextDecoder("windows-1252").decode(await response.arrayBuffer());
}

export async function fetchSeasonCalendars(base = BASE): Promise<DivisionCalendar[]> {
  const calendars: DivisionCalendar[] = [];
  for (const { division, page, script } of DIVISIONS) {
    const [html, js] = await Promise.all([
      fetchPage(`${base}/${page}`),
      fetchPage(`${base}/${script}`),
    ]);
    calendars.push({ division, ...parseCalendar(html, js) });
  }
  return calendars;
}

/** Every fixture in the season, keyed on the week and the two teams. */
export function fixtureKey(weekCommencing: string, homeTeam: string, awayTeam: string): string {
  return `${weekCommencing}|${homeTeam}|${awayTeam}`;
}

/**
 * The night a fixture is played: the Monday of its week plus the home
 * club's own night.
 *
 * The league publishes this in a tooltip and nowhere else, which is why the
 * first import of the programme put the Monday in both date fields. `night`
 * is a `DAY_OF_WEEK` value from the team's own record.
 */
const DAY_OFFSET: Record<string, number> = {
  monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4, saturday: 5, sunday: 6,
};

export function playedOnFrom(weekCommencing: string, night: string | null | undefined): string | null {
  const offset = night ? DAY_OFFSET[night] : undefined;
  if (offset === undefined) return null;
  const at = Date.UTC(
    Number(weekCommencing.slice(0, 4)),
    Number(weekCommencing.slice(5, 7)) - 1,
    Number(weekCommencing.slice(8, 10)),
  );
  return new Date(at + offset * 86_400_000).toISOString().slice(0, 10);
}
