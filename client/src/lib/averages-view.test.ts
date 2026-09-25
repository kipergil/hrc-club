import { describe, expect, it } from "vitest";
import type { PlayerStat } from "@shared/types.js";
import {
  filterStats,
  firstDirection,
  isSortKey,
  sortStats,
  teamOptions,
  withPlaces,
} from "./averages-view";

let seq = 0;
function stat(overrides: Partial<PlayerStat> = {}): PlayerStat {
  seq += 1;
  return {
    id: `p${seq}`,
    memberName: `Player ${seq}`,
    memberSlug: `player-${seq}`,
    seasonLabel: "2026-27",
    teamName: "HRC A",
    teamSlug: "hrc-a",
    division: "premier",
    played: 3,
    won: 2,
    lost: 1,
    winPercentage: 67,
    handicap: null,
    meetsParticipationThreshold: true,
    matchesPlayed: 1,
    doublesPlayed: 1,
    doublesWon: 0,
    setsFor: 7,
    setsAgainst: 4,
    ...overrides,
  };
}

describe("placings", () => {
  it("places each division on its own", () => {
    const rows = withPlaces([
      stat({ id: "a", winPercentage: 100, division: "premier" }),
      stat({ id: "b", winPercentage: 90, division: "division_1" }),
      stat({ id: "c", winPercentage: 50, division: "premier" }),
    ]);
    expect(Object.fromEntries(rows.map((row) => [row.id, row.place]))).toEqual({ a: 1, b: 1, c: 2 });
  });

  it("does not place a player below the 50% rule, nor count them for anybody else's place", () => {
    const rows = withPlaces([
      stat({ id: "a", winPercentage: 100, meetsParticipationThreshold: false }),
      stat({ id: "b", winPercentage: 80 }),
    ]);
    expect(rows.find((row) => row.id === "a")!.place).toBeNull();
    expect(rows.find((row) => row.id === "b")!.place).toBe(1);
  });

  it("shares a placing between level players and skips the next", () => {
    const rows = withPlaces([
      stat({ id: "a", winPercentage: 100, played: 6 }),
      stat({ id: "b", winPercentage: 67, played: 3 }),
      stat({ id: "c", winPercentage: 67, played: 3 }),
      stat({ id: "d", winPercentage: 33, played: 3 }),
    ]);
    const byId = Object.fromEntries(rows.map((row) => [row.id, row]));
    expect([byId.a!.place, byId.b!.place, byId.c!.place, byId.d!.place]).toEqual([1, 2, 2, 4]);
    expect([byId.a!.tied, byId.b!.tied, byId.c!.tied, byId.d!.tied]).toEqual([false, true, true, false]);
  });

  it("keeps a player's division placing when the page is narrowed to their team", () => {
    // Placed first, filtered second: HRC B's best player is not "1st".
    const rows = withPlaces([
      stat({ id: "a", winPercentage: 100, teamSlug: "hrc-a" }),
      stat({ id: "b", winPercentage: 67, teamSlug: "hrc-b", teamName: "HRC B" }),
    ]);
    expect(filterStats(rows, { team: "hrc-b" }).map((row) => row.place)).toEqual([2]);
  });
});

describe("filters", () => {
  const rows = [
    stat({ id: "a", division: "premier", teamSlug: "hrc-a", teamName: "HRC A" }),
    stat({ id: "b", division: "division_1", teamSlug: "hrc-c", teamName: "HRC C" }),
    stat({ id: "c", division: "division_1", teamSlug: "kidston", teamName: "Kidston" }),
  ];

  it("filters by division and by team, together", () => {
    expect(filterStats(rows, { division: "division_1" }).map((row) => row.id)).toEqual(["b", "c"]);
    expect(filterStats(rows, { division: "all", team: "hrc-c" }).map((row) => row.id)).toEqual(["b"]);
    expect(filterStats(rows, { division: "premier", team: "hrc-c" })).toEqual([]);
  });

  it("offers only the teams in the chosen division, A to Z", () => {
    expect(teamOptions(rows).map((team) => team.label)).toEqual(["HRC A", "HRC C", "Kidston"]);
    expect(teamOptions(rows, "division_1").map((team) => team.value)).toEqual(["hrc-c", "kidston"]);
  });

  it("uses the team's name where an archived row has no slug", () => {
    const archived = stat({ teamSlug: null, teamName: "Old Team" });
    expect(teamOptions([archived])[0]!.value).toBe("Old Team");
    expect(filterStats([archived], { team: "Old Team" })).toHaveLength(1);
  });
});

describe("sorting", () => {
  const ids = (rows: { id: string }[]) => rows.map((row) => row.id);

  it("sorts any statistic either way", () => {
    const rows = withPlaces([
      stat({ id: "a", won: 1 }),
      stat({ id: "b", won: 3 }),
      stat({ id: "c", won: 2 }),
    ]);
    expect(ids(sortStats(rows, "won", "desc"))).toEqual(["b", "c", "a"]);
    expect(ids(sortStats(rows, "won", "asc"))).toEqual(["a", "c", "b"]);
  });

  it("sorts sets by the difference, not the number won", () => {
    const rows = withPlaces([
      stat({ id: "a", setsFor: 9, setsAgainst: 6 }),
      stat({ id: "b", setsFor: 6, setsAgainst: 1 }),
    ]);
    expect(ids(sortStats(rows, "sets", "desc"))).toEqual(["b", "a"]);
  });

  it("keeps rows with no figure at the bottom whichever way the column runs", () => {
    const rows = withPlaces([
      stat({ id: "old", setsFor: null, setsAgainst: null }),
      stat({ id: "a", setsFor: 9, setsAgainst: 0 }),
      stat({ id: "b", setsFor: 1, setsAgainst: 9 }),
    ]);
    expect(ids(sortStats(rows, "sets", "desc"))).toEqual(["a", "b", "old"]);
    expect(ids(sortStats(rows, "sets", "asc"))).toEqual(["b", "a", "old"]);
  });

  it("puts unplaced players after the placed ones in placing order", () => {
    const rows = withPlaces([
      stat({ id: "unplaced", winPercentage: 100, meetsParticipationThreshold: false }),
      stat({ id: "second", winPercentage: 50 }),
      stat({ id: "first", winPercentage: 80 }),
    ]);
    expect(ids(sortStats(rows, "place", "asc"))).toEqual(["first", "second", "unplaced"]);
  });

  it("falls back to the league's order on a tie, so rows never shuffle", () => {
    const rows = withPlaces([
      stat({ id: "a", lost: 1, winPercentage: 50, memberName: "Zed" }),
      stat({ id: "b", lost: 1, winPercentage: 90, memberName: "Amy" }),
    ]);
    expect(ids(sortStats(rows, "lost", "desc"))).toEqual(["b", "a"]);
  });

  it("reads names A to Z and numbers biggest first on the first click", () => {
    expect(firstDirection("name")).toBe("asc");
    expect(firstDirection("place")).toBe("asc");
    expect(firstDirection("percent")).toBe("desc");
  });

  it("ignores a sort key it does not know, from a hand-edited link", () => {
    expect(isSortKey("won")).toBe(true);
    expect(isSortKey("dropTable")).toBe(false);
    expect(isSortKey(undefined)).toBe(false);
  });
});
