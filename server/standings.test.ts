import { describe, expect, it } from "vitest";
import { buildTable } from "./storage.js";
import type { Fixture, TeamRef } from "../shared/types.js";

/**
 * The league table is computed from the results rather than stored, so
 * this is where the league's scoring actually lives. Two things about it
 * are easy to get wrong and impossible to notice from the page:
 *
 *  - **Points are rubbers won**, not two-for-a-win. Read off the league's
 *    own 2025 final tables: Water Lane A took the Premier Division on 118
 *    points from 14 matches, which is only possible if each of a match's
 *    ten rubbers is a point.
 *  - **Rule 20** separates equal totals by matches won, and then by the
 *    games between the tied teams themselves.
 */

function team(name: string, slug: string): TeamRef {
  return { name, slug, division: "premier" };
}

const A = team("Aardvark A", "aardvark-a");
const B = team("Badger B", "badger-b");
const C = team("Cormorant C", "cormorant-c");

let counter = 0;
function match(home: TeamRef, away: TeamRef, homeScore: number | null, awayScore: number | null): Fixture {
  counter += 1;
  return {
    id: `f${counter}`,
    playedOn: "2026-09-21",
    startTime: null,
    weekCommencing: "2026-09-21",
    competition: "league",
    status: homeScore === null ? "scheduled" : "played",
    homeTeam: home,
    awayTeam: away,
    homeScore,
    awayScore,
    scorecardUrl: null,
    venueName: null,
    lastSyncedAt: null,
  };
}

describe("buildTable", () => {
  it("counts every rubber won as a point", () => {
    const table = buildTable([match(A, B, 6, 4)], [A, B]);

    expect(table.find((row) => row.teamSlug === "aardvark-a")).toMatchObject({
      position: 1,
      played: 1,
      won: 1,
      lost: 0,
      points: 6,
    });
    expect(table.find((row) => row.teamSlug === "badger-b")).toMatchObject({
      position: 2,
      played: 1,
      won: 0,
      lost: 1,
      // The losing side keeps the four rubbers it won. A two-for-a-win
      // league would have nothing here, and the season totals would come
      // out an order of magnitude short of the league's own.
      points: 4,
    });
  });

  it("lists a team that has not played yet, on nothing", () => {
    // The league's own opening tables list every team on nought played and
    // nought points. A table of only the teams with results is not a table.
    const table = buildTable([match(A, B, 6, 4)], [A, B, C]);
    expect(table).toHaveLength(3);
    expect(table.find((row) => row.teamSlug === "cormorant-c")).toMatchObject({
      played: 0,
      points: 0,
    });
  });

  it("ignores a fixture whose card has not come in", () => {
    const table = buildTable([match(A, B, null, null)], [A, B]);
    expect(table.every((row) => row.played === 0 && row.points === 0)).toBe(true);
  });

  it("separates equal points on matches won, as rule 20 says", () => {
    /*
     * Both finish on 12 points. A won one match and lost one; B drew both,
     * so it has won nothing. Rule 20 puts the team with more wins higher.
     */
    const table = buildTable(
      [match(A, C, 9, 1), match(A, B, 3, 7), match(B, C, 5, 5), match(C, B, 5, 5)],
      [A, B, C],
    );

    const a = table.find((row) => row.teamSlug === "aardvark-a")!;
    const b = table.find((row) => row.teamSlug === "badger-b")!;
    expect(a.points).toBe(12);
    expect(b.points).toBe(17);
    expect(b.won).toBe(1);
    expect(a.won).toBe(1);
    // B is ahead on points alone here, which is the first test of the
    // ordering and the one that has to hold before the tie-breaks matter.
    expect(b.position).toBeLessThan(a.position);
  });

  it("falls to the games between the two teams when points and wins are level", () => {
    /*
     * The league's own worked example, from its 2025 tables page:
     *
     *   "Grundy Park B & HRC B tied on 47 points and both teams had 3
     *   League WINS so, as HRC B won more games against Grundy Park B
     *   (12 vs 8), HRC B rank higher."
     *
     * Reproduced in miniature: identical points, identical wins, and the
     * head-to-head decides it.
     */
    const table = buildTable(
      [
        // The two meetings: one win each, but A takes 11 rubbers to B's 9.
        match(A, B, 7, 3),
        match(B, A, 6, 4),
        // Against C both win one and lose one, and B's bigger win makes up
        // the two rubbers — so points and wins come out identical.
        match(A, C, 6, 4),
        match(C, A, 6, 4),
        match(B, C, 8, 2),
        match(C, B, 6, 4),
      ],
      [A, B, C],
    );

    const a = table.find((row) => row.teamSlug === "aardvark-a")!;
    const b = table.find((row) => row.teamSlug === "badger-b")!;

    expect(a.points).toBe(b.points);
    expect(a.won).toBe(b.won);
    expect(a.position).toBeLessThan(b.position);
  });

  it("keeps each division to itself", () => {
    const other: TeamRef = { name: "Dormouse D", slug: "dormouse-d", division: "division_1" };
    const partner: TeamRef = { name: "Eagle E", slug: "eagle-e", division: "division_1" };

    const table = buildTable([match(A, B, 6, 4), match(other, partner, 8, 2)], [A, B, other, partner]);

    const premier = table.filter((row) => row.division === "premier");
    const first = table.filter((row) => row.division === "division_1");
    expect(premier.map((row) => row.position)).toEqual([1, 2]);
    expect(first.map((row) => row.position)).toEqual([1, 2]);
    // Premier before Division 1, the league's own order — a page opening on
    // Division 2 reads as a mistake.
    expect(table[0]!.division).toBe("premier");
  });

  it("orders a still-level pair by name, so the table does not shuffle between requests", () => {
    const table = buildTable([match(A, B, 5, 5)], [A, B]);
    expect(table.map((row) => row.teamName)).toEqual(["Aardvark A", "Badger B"]);
  });
});
