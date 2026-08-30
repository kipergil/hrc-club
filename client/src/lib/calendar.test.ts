import { describe, expect, it } from "vitest";
import type { Fixture, TeamRef } from "@shared/types.js";
import { buildCalendar } from "./calendar";

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

    expect(segment!.weeks).toEqual(["2026-09-14", "2026-09-21"]);
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
    expect(segments[0]!.weeks).toEqual(["2026-12-14"]);
    expect(segments[1]!.weeks).toEqual(["2027-01-11"]);
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
    expect(segment!.weeks).toEqual(["2026-09-14", "2026-10-05"]);
  });

  it("falls back to the date played when a fixture has no week", () => {
    const [segment] = buildCalendar([
      fixture("2026-09-14", "a", "b", { weekCommencing: null, playedOn: "2026-09-16" }),
    ]);
    expect(segment!.weeks).toEqual(["2026-09-16"]);
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
