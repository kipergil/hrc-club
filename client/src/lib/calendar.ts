import type { Fixture, TeamRef } from "@shared/types.js";

/**
 * Turns a division's fixture list into the season grid the league publishes
 * at `Calendarz.asp?Div=…` — teams down the side, weeks across the top.
 *
 * The chronological list on `/fixtures` answers "what is on this week".
 * This answers a different question, and the one a captain actually has
 * when a match needs rearranging: *when are we free, and when do we play
 * them?* Reading that off a list means scanning sixteen weeks for two
 * mentions of your own team; on a grid it is one row.
 *
 * Pure, and tested, because the interesting cases are all structural — a
 * team with a bye, a division with an odd number of teams, a week that
 * exists for one division and not another — and none of them throw.
 */

export interface CalendarCell {
  /**
   * Every match this team plays that week. Normally none or one; a list
   * because a rearranged fixture can land a team two matches in a week,
   * and silently showing one of them would be worse than showing both.
   */
  entries: Array<{ fixture: Fixture; isHome: boolean; opponent: TeamRef }>;
}

export interface CalendarRow {
  team: TeamRef;
  cells: CalendarCell[];
}

/**
 * One grid. The season is split into segments by calendar year, as the
 * league splits it, because a single thirty-two-column table is a very
 * long horizontal scroll for something a reader wants to take in at once.
 */
export interface CalendarSegment {
  /** e.g. "2026" — the heading above this half of the season. */
  year: string;
  /** Week-commencing dates, ascending, ISO. */
  weeks: string[];
  rows: CalendarRow[];
}

function weekOf(fixture: Fixture): string | null {
  return fixture.weekCommencing ?? fixture.playedOn ?? null;
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

function byWeek(a: Fixture, b: Fixture): number {
  return (weekOf(a) ?? "").localeCompare(weekOf(b) ?? "");
}

export function buildCalendar(fixtures: Fixture[]): CalendarSegment[] {
  const dated = fixtures.filter((fixture) => weekOf(fixture) !== null);
  if (dated.length === 0) return [];

  const teams = teamsInProgrammeOrder(dated);
  const weeks = [...new Set(dated.map((fixture) => weekOf(fixture)!))].sort();

  // Every team's matches, by week, looked up rather than scanned per cell:
  // the naive version is O(teams × weeks × fixtures), which on a full
  // season is a few hundred thousand comparisons for one page.
  const byTeamWeek = new Map<string, CalendarCell["entries"]>();
  for (const fixture of dated) {
    const week = weekOf(fixture)!;
    for (const [team, opponent, isHome] of [
      [fixture.homeTeam, fixture.awayTeam, true],
      [fixture.awayTeam, fixture.homeTeam, false],
    ] as const) {
      if (!team?.slug || !opponent) continue;
      const key = `${team.slug}|${week}`;
      byTeamWeek.set(key, [...(byTeamWeek.get(key) ?? []), { fixture, isHome, opponent }]);
    }
  }

  const segments = new Map<string, string[]>();
  for (const week of weeks) {
    const year = week.slice(0, 4);
    segments.set(year, [...(segments.get(year) ?? []), week]);
  }

  return [...segments.entries()].map(([year, segmentWeeks]) => ({
    year,
    weeks: segmentWeeks,
    rows: teams.map((team) => ({
      team,
      cells: segmentWeeks.map((week) => ({
        entries: byTeamWeek.get(`${team.slug}|${week}`) ?? [],
      })),
    })),
  }));
}
