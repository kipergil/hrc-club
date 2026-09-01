import { describe, expect, it } from "vitest";
import { buildAverages, type AverageSource } from "./averages.js";

let fixtureSeq = 0;

function singles(
  memberId: string,
  won: boolean,
  overrides: Partial<AverageSource> = {},
): AverageSource {
  return {
    memberId,
    memberName: `Player ${memberId}`,
    memberSlug: `player-${memberId}`,
    kind: "singles",
    won,
    fixtureId: `f${(fixtureSeq += 1)}`,
    teamName: "HRC B",
    teamSlug: "hrc-b",
    division: "premier",
    ...overrides,
  };
}

/** Three singles in one match, as a card actually produces. */
function match(memberId: string, wins: number, fixtureId: string, overrides: Partial<AverageSource> = {}) {
  return Array.from({ length: 3 }, (_, i) =>
    singles(memberId, i < wins, { fixtureId, ...overrides }),
  );
}

describe("buildAverages", () => {
  it("counts singles played, won and lost", () => {
    const rows = buildAverages([
      ...match("a", 2, "f1"),
      ...match("a", 3, "f2"),
    ]);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ played: 6, won: 5, lost: 1 });
  });

  it("never lets won and lost disagree with played", () => {
    // True on all 147 rows of the league's own 2025-26 page: a rubber
    // cannot be drawn, so there is no third column to reconcile.
    const rows = buildAverages([...match("a", 1, "f1"), ...match("b", 0, "f1")]);
    for (const row of rows) expect(row.won + row.lost).toBe(row.played);
  });

  it("leaves the doubles out", () => {
    /*
     * Including it would put a full fourteen-match season at 56; the
     * highest figure the league prints is 44. The doubles is a pair's
     * result, not a player's.
     */
    const rows = buildAverages([
      ...match("a", 3, "f1"),
      singles("a", true, { kind: "doubles", fixtureId: "f1" }),
    ]);
    expect(rows[0]!.played).toBe(3);
  });

  it("works out the percentage the way the league prints it", () => {
    // 31 of 41 is 75.6%, and the league's page says 76.
    const rubbers = [
      ...Array.from({ length: 31 }, (_, i) => singles("a", true, { fixtureId: `w${i}` })),
      ...Array.from({ length: 10 }, (_, i) => singles("a", false, { fixtureId: `l${i}` })),
    ];
    expect(buildAverages(rubbers)[0]).toMatchObject({ played: 41, won: 31, winPercentage: 76 });
  });

  it("orders by percentage, then by how much was played", () => {
    // The league calls this "averages sequence": eight from eight beats
    // six from six, and both beat 94%.
    const rows = buildAverages([
      ...Array.from({ length: 6 }, (_, i) => singles("six", true, { fixtureId: `a${i}` })),
      ...Array.from({ length: 8 }, (_, i) => singles("eight", true, { fixtureId: `b${i}` })),
      ...Array.from({ length: 17 }, (_, i) => singles("most", true, { fixtureId: `c${i}` })),
      singles("most", false, { fixtureId: "c-loss" }),
    ]);
    expect(rows.map((row) => row.memberId)).toEqual(["eight", "six", "most"]);
  });

  it("counts matches by distinct fixture, not by rubber", () => {
    // Three singles in one match is one match played, and the 50% rule
    // is measured in matches.
    const rows = buildAverages([...match("a", 2, "f1"), ...match("a", 1, "f1")]);
    expect(rows[0]!.matchesPlayed).toBe(1);
  });

  it("applies the league's 50%-of-matches rule", () => {
    const rubbers = [
      ...match("regular", 2, "f1"),
      ...match("regular", 2, "f2"),
      ...match("regular", 2, "f3"),
      ...match("regular", 2, "f4"),
      ...match("guest", 3, "f1"),
    ];
    const rows = buildAverages(rubbers, { "hrc-b": 8 });
    const regular = rows.find((row) => row.memberId === "regular")!;
    const guest = rows.find((row) => row.memberId === "guest")!;

    expect(regular.matchesPlayed).toBe(4); // exactly half of eight
    expect(regular.meetsParticipationThreshold).toBe(true);
    expect(guest.matchesPlayed).toBe(1);
    expect(guest.meetsParticipationThreshold).toBe(false);
  });

  it("measures the rule against that team's own programme", () => {
    /*
     * Division One played twelve matches in 2025-26 and the Premier
     * played fourteen. Playing every match of a shorter season is not
     * less committed, so the threshold follows the team.
     */
    const rubbers = [
      ...match("a", 2, "f1", { teamSlug: "div-one", teamName: "Water Lane B", division: "division_1" }),
      ...match("a", 2, "f2", { teamSlug: "div-one", teamName: "Water Lane B", division: "division_1" }),
      ...match("a", 2, "f3", { teamSlug: "div-one", teamName: "Water Lane B", division: "division_1" }),
    ];
    expect(buildAverages(rubbers, { "div-one": 6 })[0]!.meetsParticipationThreshold).toBe(true);
    expect(buildAverages(rubbers, { "div-one": 14 })[0]!.meetsParticipationThreshold).toBe(false);
  });

  it("counts everyone as eligible when the team's programme is unknown", () => {
    // Better than greying out an entire division because a count is
    // missing — that would look like a judgement on the players.
    expect(buildAverages(match("a", 1, "f1"))[0]!.meetsParticipationThreshold).toBe(true);
  });

  it("places a player who turned out twice with the team they played most for", () => {
    /*
     * A player who plays up appears in their own division's table, not
     * in whichever card happened to name them first.
     */
    const rubbers = [
      ...match("a", 2, "f1", { teamSlug: "hrc-c", teamName: "HRC C", division: "division_1" }),
      ...match("a", 2, "f2", { teamSlug: "hrc-c", teamName: "HRC C", division: "division_1" }),
      ...match("a", 1, "f3", { teamSlug: "hrc-a", teamName: "HRC A", division: "premier" }),
    ];
    const row = buildAverages(rubbers)[0]!;
    expect(row.teamName).toBe("HRC C");
    expect(row.division).toBe("division_1");
    // Their whole record still counts, both teams together.
    expect(row.played).toBe(9);
  });

  it("returns nothing when no singles were played", () => {
    expect(buildAverages([])).toEqual([]);
    expect(buildAverages([singles("a", true, { kind: "doubles" })])).toEqual([]);
  });

  it("ignores a rubber with nobody attached to it", () => {
    // The opposition are names on a card rather than members, so most
    // rubbers carry a member on one side only.
    expect(buildAverages([singles("", true)])).toEqual([]);
  });
});
