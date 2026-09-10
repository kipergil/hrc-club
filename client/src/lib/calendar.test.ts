import { describe, expect, it } from "vitest";
import type { Fixture, TeamRef } from "@shared/types.js";
import { buildCalendar, buildWeekBlocks, type CalendarSegment } from "./calendar";
import type { CalendarWeek } from "@shared/types.js";

const weeksOf = (segment: CalendarSegment) =>
  segment.columns.map((column) => column.weekCommencing);

function week(
  weekNumber: number,
  weekCommencing: string,
  kind: CalendarWeek["kind"] = "matches",
  label: string | null = null,
): CalendarWeek {
  return { weekNumber, weekCommencing, kind, label, note: null };
}

function team(slug: string): TeamRef {
  return { slug, name: slug.toUpperCase(), division: "premier" };
}

let nextId = 0;
function fixture(week: string, home: string, away: string, overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: `f${(nextId += 1)}`,
    playedOn: null,
    startTime: null,
    weekCommencing: week,
    competition: "league",
    status: "scheduled",
    homeTeam: team(home),
    awayTeam: team(away),
    homeScore: null,
    awayScore: null,
    scorecardUrl: null,
    venueName: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

describe("buildCalendar", () => {
  it("gives every team a row and every week a column", () => {
    const [segment] = buildCalendar([
      fixture("2026-09-14", "a", "b"),
      fixture("2026-09-14", "c", "d"),
      fixture("2026-09-21", "b", "c"),
      fixture("2026-09-21", "d", "a"),
    ]);

    expect(weeksOf(segment!)).toEqual(["2026-09-14", "2026-09-21"]);
    expect(segment!.rows).toHaveLength(4);
    expect(segment!.rows.every((row) => row.cells.length === 2)).toBe(true);
  });

  it("puts each match in both teams' rows, the right way round", () => {
    const [segment] = buildCalendar([fixture("2026-09-14", "a", "b")]);
    const rowA = segment!.rows.find((row) => row.team.slug === "a")!;
    const rowB = segment!.rows.find((row) => row.team.slug === "b")!;

    expect(rowA.cells[0]!.entries[0]).toMatchObject({ isHome: true });
    expect(rowA.cells[0]!.entries[0]!.opponent.slug).toBe("b");
    expect(rowB.cells[0]!.entries[0]).toMatchObject({ isHome: false });
    expect(rowB.cells[0]!.entries[0]!.opponent.slug).toBe("a");
  });

  it("leaves a bye as an empty cell", () => {
    /*
     * A division with an odd number of teams sits one team out each week,
     * and the league prints "No Match" there. An empty cell is the thing
     * the grid exists to show — it is the answer to "when are we free" —
     * so it has to be a real absence rather than a row that is simply
     * shorter than the others.
     */
    const [segment] = buildCalendar([
      fixture("2026-09-14", "a", "b"),
      fixture("2026-09-21", "a", "c"),
    ]);
    const rowC = segment!.rows.find((row) => row.team.slug === "c")!;
    expect(rowC.cells[0]!.entries).toEqual([]);
    expect(rowC.cells[1]!.entries).toHaveLength(1);
  });

  it("keeps both matches when a rearrangement doubles a team up in one week", () => {
    // Rare, but it happens, and showing one of the two would send somebody
    // to the wrong hall.
    const [segment] = buildCalendar([
      fixture("2026-09-14", "a", "b"),
      fixture("2026-09-14", "c", "a"),
    ]);
    const rowA = segment!.rows.find((row) => row.team.slug === "a")!;
    expect(rowA.cells[0]!.entries).toHaveLength(2);
  });

  it("splits the season into segments by calendar year", () => {
    // As the league's own grid does. Thirty-two week columns in one table
    // is a very long sideways scroll for something meant to be taken in at
    // a glance.
    const segments = buildCalendar([
      fixture("2026-12-14", "a", "b"),
      fixture("2027-01-11", "a", "b"),
    ]);
    expect(segments.map((segment) => segment.year)).toEqual(["2026", "2027"]);
    expect(weeksOf(segments[0]!)).toEqual(["2026-12-14"]);
    expect(weeksOf(segments[1]!)).toEqual(["2027-01-11"]);
  });

  it("carries every team into both halves of the season", () => {
    const segments = buildCalendar([
      fixture("2026-12-14", "a", "b"),
      fixture("2027-01-11", "c", "d"),
    ]);
    expect(segments[0]!.rows).toHaveLength(4);
    expect(segments[1]!.rows).toHaveLength(4);
  });

  it("orders weeks by date, not by the order the fixtures arrived", () => {
    const [segment] = buildCalendar([
      fixture("2026-10-05", "a", "b"),
      fixture("2026-09-14", "a", "b"),
    ]);
    expect(weeksOf(segment!)).toEqual(["2026-09-14", "2026-10-05"]);
  });

  it("falls back to the date played when a fixture has no week", () => {
    const [segment] = buildCalendar([
      fixture("2026-09-14", "a", "b", { weekCommencing: null, playedOn: "2026-09-16" }),
    ]);
    expect(weeksOf(segment!)).toEqual(["2026-09-16"]);
  });

  it("ignores a fixture with no date at all rather than inventing a column", () => {
    const segments = buildCalendar([
      fixture("2026-09-14", "a", "b", { weekCommencing: null, playedOn: null }),
    ]);
    expect(segments).toEqual([]);
  });

  it("returns nothing for an empty programme", () => {
    expect(buildCalendar([])).toEqual([]);
  });
});

describe("the weeks nobody plays in", () => {
  /**
   * Fourteen of a season's thirty-two weeks have no league match in them —
   * nine cup rounds and five free weeks — and none of them can be inferred
   * from the fixture list, because from the fixtures' point of view they
   * are all identical: nothing happens. The league's own grid labels them,
   * and until `hrc_calendar_weeks` existed the site rendered a fortnight
   * of blank at Christmas with nothing to say about it.
   */
  it("shows a cup week that has no fixtures in it at all", () => {
    const [segment] = buildCalendar(
      [fixture("2026-09-21", "a", "b")],
      [week(1, "2026-09-14", "cup", "Divisional"), week(2, "2026-09-21")],
    );

    expect(weeksOf(segment!)).toEqual(["2026-09-14", "2026-09-21"]);
    expect(segment!.columns[0]).toMatchObject({
      weekNumber: 1,
      kind: "cup",
      label: "Divisional",
    });
    // And no team is playing in it, which is the point of the column.
    expect(segment!.rows.every((row) => row.cells[0]!.entries.length === 0)).toBe(true);
  });

  it("calls a free week a match week once a rearranged match lands in it", () => {
    // Free weeks exist precisely so outstanding matches can be played in
    // them. Tinting one as empty while it has a fixture in it would be the
    // calendar contradicting itself.
    const [segment] = buildCalendar(
      [fixture("2026-11-23", "a", "b")],
      [week(11, "2026-11-23", "free", "Free")],
    );
    expect(segment!.columns[0]!.kind).toBe("matches");
  });

  it("keeps a week the league's calendar does not cover", () => {
    // A match moved outside the published programme is exactly what a
    // captain is looking for. Dropping the column because the week is not
    // on a list would hide it.
    const [segment] = buildCalendar(
      [fixture("2026-09-28", "a", "b")],
      [week(1, "2026-09-14", "cup", "Divisional")],
    );
    expect(weeksOf(segment!)).toEqual(["2026-09-14", "2026-09-28"]);
    expect(segment!.columns[1]!.weekNumber).toBeNull();
  });

  it("splits the labelled weeks by year like the rest of the grid", () => {
    const segments = buildCalendar(
      [],
      [week(15, "2026-12-21", "free", "Free"), week(17, "2027-01-04", "cup", "Handicap")],
    );
    // No fixtures at all is still nothing to draw: rows come from teams,
    // and there are none.
    expect(segments).toEqual([]);
  });
});

describe("buildWeekBlocks", () => {
  /**
   * The week-by-week view exists to make the league's hidden distinction
   * impossible to miss: the week is named for its Monday and the match is
   * played on the host club's own night. Grouping by night rather than by
   * week is what does that — you cannot read a fixture without reading its
   * date.
   */
  it("gathers a week's matches under the night each is played on", () => {
    const blocks = buildWeekBlocks(
      [
        fixture("2026-09-21", "a", "b", { playedOn: "2026-09-23" }),
        fixture("2026-09-21", "c", "d", { playedOn: "2026-09-25" }),
        fixture("2026-09-21", "e", "f", { playedOn: "2026-09-23" }),
      ],
      [week(2, "2026-09-21")],
    );

    expect(blocks).toHaveLength(1);
    expect(blocks[0]!.nights.map((night) => night.date)).toEqual(["2026-09-23", "2026-09-25"]);
    expect(blocks[0]!.nights[0]!.entries).toHaveLength(2);
    expect(blocks[0]!.nights[1]!.entries).toHaveLength(1);
  });

  it("orders the nights by date, not by the order the fixtures arrived", () => {
    const blocks = buildWeekBlocks([
      fixture("2026-09-21", "a", "b", { playedOn: "2026-09-25" }),
      fixture("2026-09-21", "c", "d", { playedOn: "2026-09-22" }),
    ]);
    expect(blocks[0]!.nights.map((night) => night.date)).toEqual(["2026-09-22", "2026-09-25"]);
  });

  it("names the teams sitting out a week the rest of the division plays", () => {
    const blocks = buildWeekBlocks([
      fixture("2026-09-21", "a", "b", { playedOn: "2026-09-23" }),
      fixture("2026-09-28", "c", "d", { playedOn: "2026-09-30" }),
    ]);
    expect(blocks[0]!.restingTeams.map((team) => team.slug)).toEqual(["c", "d"]);
  });

  it("says nobody is resting on a week the whole league has off", () => {
    // "All eight teams are resting" under a free week is noise; the week's
    // own label already says it.
    const blocks = buildWeekBlocks(
      [fixture("2026-09-21", "a", "b", { playedOn: "2026-09-23" })],
      [week(2, "2026-09-21"), week(11, "2026-11-23", "free", "Free")],
    );
    const free = blocks.find((block) => block.column.kind === "free")!;
    expect(free.restingTeams).toEqual([]);
    expect(free.nights).toEqual([]);
  });

  it("carries the week's own label through to the block", () => {
    const blocks = buildWeekBlocks(
      [fixture("2026-09-21", "a", "b", { playedOn: "2026-09-23" })],
      [week(1, "2026-09-14", "cup", "Divisional"), week(2, "2026-09-21")],
    );
    expect(blocks[0]!.column).toMatchObject({ weekNumber: 1, kind: "cup", label: "Divisional" });
  });

  it("falls back to the week when a fixture has no night of its own", () => {
    // Every archived season is like this: imported from the league's
    // results tables, which give the week and nothing finer.
    const blocks = buildWeekBlocks([fixture("2026-09-21", "a", "b")]);
    expect(blocks[0]!.nights[0]!.date).toBe("2026-09-21");
  });

  it("returns nothing for an empty programme with no calendar", () => {
    expect(buildWeekBlocks([])).toEqual([]);
  });
});
