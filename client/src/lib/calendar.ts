import type { CalendarWeek, Fixture, TeamRef } from "@shared/types.js";

/**
 * Turns a division's fixture list into the season calendar the league
 * publishes at `Calendar0/1/2.htm`.
 *
 * The chronological list on `/fixtures` answers "what is on this week".
 * This answers a different question, and the one a captain actually has
 * when a match needs rearranging: *when are we free, and when do we play
 * them?* Reading that off a list means scanning sixteen weeks for two
 * mentions of your own team; on a grid it is one row.
 *
 * Two shapes come out of the same data, because the page offers both. The
 * grid is the league's own table — teams down, weeks across — and reads as
 * a season. The week list is the same information turned ninety degrees,
 * one block per week with the matches under the night they fall on, and
 * reads as a diary. Neither is a subset of the other and the switch between
 * them is one click, so both are built here and the page picks.
 *
 * Pure, and tested, because the interesting cases are all structural — a
 * team with a bye, a division with an odd number of teams, a week the whole
 * league has off — and none of them throw.
 */

export interface CalendarEntry {
  fixture: Fixture;
  isHome: boolean;
  opponent: TeamRef;
}

export interface CalendarCell {
  /**
   * Every match this team plays that week. Normally none or one; a list
   * because a rearranged fixture can land a team two matches in a week,
   * and silently showing one of them would be worse than showing both.
   */
  entries: CalendarEntry[];
}

export interface CalendarRow {
  team: TeamRef;
  cells: CalendarCell[];
}

/**
 * A column of the grid, and a block of the week list.
 *
 * `kind` and `label` come from the league's own calendar where the site
 * holds it, and are inferred otherwise: an archived season has no calendar
 * — its pages came down years ago — so a week with fixtures in it is a
 * match week and there are no others.
 */
export interface CalendarColumn {
  /** 1 for the first week of the season, or null for an inferred week. */
  weekNumber: number | null;
  /** The Monday, ISO. */
  weekCommencing: string;
  kind: CalendarWeek["kind"];
  /** "Divisional", "Handicap", "Finals", "Free". */
  label: string | null;
  note: string | null;
}

/**
 * One grid. The season is split by calendar year, as the league splits it
 * into two sixteen-week halves, because a single thirty-two-column table
 * is a very long horizontal scroll for something a reader wants to take in
 * at once.
 */
export interface CalendarSegment {
  /** e.g. "2026" — the heading above this half of the season. */
  year: string;
  columns: CalendarColumn[];
  rows: CalendarRow[];
}

/** One night, and the matches on it. */
export interface CalendarNight {
  /** ISO date of the evening these are played. */
  date: string;
  entries: Array<{ fixture: Fixture; home: TeamRef; away: TeamRef }>;
}

/** One week of the season, for the week-by-week view. */
export interface CalendarWeekBlock {
  column: CalendarColumn;
  nights: CalendarNight[];
  /** Teams with no match that week. Empty on a cup or free week. */
  restingTeams: TeamRef[];
}

function weekOf(fixture: Fixture): string | null {
  return fixture.weekCommencing ?? fixture.playedOn ?? null;
}

/** The night a match is played, falling back to its week if it has none. */
export function nightOf(fixture: Fixture): string | null {
  return fixture.playedOn ?? fixture.weekCommencing ?? null;
}

function byWeek(a: Fixture, b: Fixture): number {
  return (weekOf(a) ?? "").localeCompare(weekOf(b) ?? "");
}

/**
 * Teams in the order the league's own grid uses — the order they first
 * appear in the fixture programme, which is the rotation order the
 * schedule was generated from, so a team's opponents run diagonally and
 * the grid reads as a pattern rather than as noise.
 *
 * Falling back to alphabetical would be defensible and is what a naive
 * implementation does; it also throws away the only structure the grid
 * has.
 */
function teamsInProgrammeOrder(fixtures: Fixture[]): TeamRef[] {
  const seen = new Map<string, TeamRef>();
  for (const fixture of [...fixtures].sort(byWeek)) {
    for (const team of [fixture.homeTeam, fixture.awayTeam]) {
      if (team?.slug && !seen.has(team.slug)) seen.set(team.slug, team);
    }
  }
  return [...seen.values()];
}

/**
 * Every week the calendar should show, whether or not anybody plays in it.
 *
 * The league's weeks are used where the site holds them, because they are
 * the only place a cup round or a free week is written down. Any week with
 * a fixture in it that the league's list does not cover is added rather
 * than dropped — a rearranged match landing outside the programme is
 * exactly the thing a captain is looking for, and a calendar that hides it
 * because the week is not on a list is worse than one with an extra column.
 */
function columnsFor(fixtures: Fixture[], weeks: CalendarWeek[]): CalendarColumn[] {
  const columns = new Map<string, CalendarColumn>();

  for (const week of weeks) {
    if (!week.weekCommencing) continue;
    columns.set(week.weekCommencing, {
      weekNumber: week.weekNumber || null,
      weekCommencing: week.weekCommencing,
      kind: week.kind,
      label: week.label,
      note: week.note,
    });
  }

  for (const fixture of fixtures) {
    const week = weekOf(fixture);
    if (!week) continue;
    const existing = columns.get(week);
    // A week the league calls free or cup, with a match played in it, is a
    // match week for this division: the free weeks exist precisely so that
    // rearranged matches can be played in them.
    if (existing) columns.set(week, { ...existing, kind: "matches" });
    else
      columns.set(week, {
        weekNumber: null,
        weekCommencing: week,
        kind: "matches",
        label: null,
        note: null,
      });
  }

  return [...columns.values()].sort((a, b) => a.weekCommencing.localeCompare(b.weekCommencing));
}

/** Every team's matches that week, looked up rather than scanned per cell. */
function indexByTeamWeek(fixtures: Fixture[]): Map<string, CalendarEntry[]> {
  // The naive version is O(teams × weeks × fixtures), which on a full
  // season is a few hundred thousand comparisons for one page.
  const index = new Map<string, CalendarEntry[]>();
  for (const fixture of fixtures) {
    const week = weekOf(fixture);
    if (!week) continue;
    for (const [team, opponent, isHome] of [
      [fixture.homeTeam, fixture.awayTeam, true],
      [fixture.awayTeam, fixture.homeTeam, false],
    ] as const) {
      if (!team?.slug || !opponent) continue;
      const key = `${team.slug}|${week}`;
      index.set(key, [...(index.get(key) ?? []), { fixture, isHome, opponent }]);
    }
  }
  return index;
}

export function buildCalendar(fixtures: Fixture[], weeks: CalendarWeek[] = []): CalendarSegment[] {
  const dated = fixtures.filter((fixture) => weekOf(fixture) !== null);
  if (dated.length === 0) return [];

  const teams = teamsInProgrammeOrder(dated);
  const columns = columnsFor(dated, weeks);
  const byTeamWeek = indexByTeamWeek(dated);

  const segments = new Map<string, CalendarColumn[]>();
  for (const column of columns) {
    const year = column.weekCommencing.slice(0, 4);
    segments.set(year, [...(segments.get(year) ?? []), column]);
  }

  return [...segments.entries()].map(([year, segmentColumns]) => ({
    year,
    columns: segmentColumns,
    rows: teams.map((team) => ({
      team,
      cells: segmentColumns.map((column) => ({
        entries: byTeamWeek.get(`${team.slug}|${column.weekCommencing}`) ?? [],
      })),
    })),
  }));
}

/**
 * The same season as a list of weeks, each week's matches gathered under
 * the night they are played on.
 *
 * This is the view that makes the league's own hidden distinction visible:
 * the week is Monday's date and the match is on the host club's night, and
 * here you cannot read a fixture without reading its date.
 */
export function buildWeekBlocks(
  fixtures: Fixture[],
  weeks: CalendarWeek[] = [],
): CalendarWeekBlock[] {
  const dated = fixtures.filter((fixture) => weekOf(fixture) !== null);
  if (dated.length === 0 && weeks.length === 0) return [];

  const teams = teamsInProgrammeOrder(dated);
  const columns = columnsFor(dated, weeks);

  const byWeekKey = new Map<string, Fixture[]>();
  for (const fixture of dated) {
    const week = weekOf(fixture)!;
    byWeekKey.set(week, [...(byWeekKey.get(week) ?? []), fixture]);
  }

  return columns.map((column) => {
    const inWeek = byWeekKey.get(column.weekCommencing) ?? [];

    const nights = new Map<string, CalendarNight["entries"]>();
    const playing = new Set<string>();
    for (const fixture of inWeek) {
      const date = nightOf(fixture);
      if (!date || !fixture.homeTeam || !fixture.awayTeam) continue;
      nights.set(date, [
        ...(nights.get(date) ?? []),
        { fixture, home: fixture.homeTeam, away: fixture.awayTeam },
      ]);
      playing.add(fixture.homeTeam.slug);
      playing.add(fixture.awayTeam.slug);
    }

    return {
      column,
      nights: [...nights.entries()]
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([date, entries]) => ({
          date,
          entries: entries.sort((a, b) => a.home.name.localeCompare(b.home.name)),
        })),
      // Only worth saying on a week where the rest of the division is
      // playing. On a cup or free week "everybody is resting" is noise.
      restingTeams:
        inWeek.length === 0 ? [] : teams.filter((team) => !playing.has(team.slug)),
    };
  });
}
