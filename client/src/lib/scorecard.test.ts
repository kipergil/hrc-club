import { describe, expect, it } from "vitest";
import type { Rubber } from "@shared/types.js";
import { flipScoreDetail, orientRubber } from "./scorecard";

function rubber(overrides: Partial<Rubber> = {}): Rubber {
  return {
    id: "r1",
    rubberNumber: 1,
    memberName: "Sunil Trakru",
    memberSlug: "sunil-trakru",
    opponentPlayerName: "Shaun Gardner",
    memberIsHome: true,
    setsFor: 3,
    setsAgainst: 1,
    won: true,
    scoreDetail: "11-7, 9-11, 11-8, 11-5",
    ...overrides,
  };
}

describe("orientRubber", () => {
  it("leaves a home row as it stands", () => {
    const row = orientRubber(rubber());
    expect(row.home.name).toBe("Sunil Trakru");
    expect(row.away.name).toBe("Shaun Gardner");
    expect([row.homeSets, row.awaySets]).toEqual([3, 1]);
    expect(row.homeWon).toBe(true);
  });

  it("turns an away row round so the names land in the right columns", () => {
    /*
     * The bug this replaces: the card printed `memberName` under the
     * fixture's *home* heading regardless of which side they played for,
     * so every away match listed its players under the opposition's name.
     */
    const row = orientRubber(rubber({ memberIsHome: false }));
    expect(row.home.name).toBe("Shaun Gardner");
    expect(row.away.name).toBe("Sunil Trakru");
  });

  it("turns the set counts round with them", () => {
    // Stored 3–1 to the member; the member is away, so the column reads 1–3.
    const row = orientRubber(rubber({ memberIsHome: false }));
    expect([row.homeSets, row.awaySets]).toEqual([1, 3]);
    expect(row.homeWon).toBe(false);
  });

  it("turns the game scores round too", () => {
    /*
     * The half-fixed version of this: sets flipped, detail left alone. The
     * row then reads "1–3" beside "11-7, 9-11, 11-8, 11-5", which says the
     * home player won three games and lost the rubber.
     */
    const row = orientRubber(rubber({ memberIsHome: false }));
    expect(row.scoreDetail).toBe("7-11, 11-9, 8-11, 5-11");
  });

  it("keeps the sets and the games agreeing, whichever side is recorded", () => {
    // The property that actually matters: count the games the home side
    // won in the detail, and it must equal the home sets.
    for (const memberIsHome of [true, false]) {
      const row = orientRubber(rubber({ memberIsHome }));
      const homeGames = row.scoreDetail!.split(",").filter((game) => {
        const [a, b] = game.trim().split("-").map(Number);
        return (a ?? 0) > (b ?? 0);
      }).length;
      expect(homeGames).toBe(row.homeSets);
    }
  });

  it("only links the player the site actually holds", () => {
    // The opposition are free text on the card, so they never get a link.
    const away = orientRubber(rubber({ memberIsHome: false }));
    expect(away.away.slug).toBe("sunil-trakru");
    expect(away.home.slug).toBeNull();
  });

  it("carries a doubles pair through as a name with no profile behind it", () => {
    const row = orientRubber(
      rubber({
        memberName: "Sunil Trakru & Anuj Patel",
        memberSlug: null,
        opponentPlayerName: "Shaun Gardner & Daniel Gillett",
      }),
    );
    expect(row.home.name).toBe("Sunil Trakru & Anuj Patel");
    expect(row.home.slug).toBeNull();
  });

  it("copes with a card that recorded no game scores", () => {
    expect(orientRubber(rubber({ scoreDetail: null, memberIsHome: false })).scoreDetail).toBeNull();
  });
});

describe("flipScoreDetail", () => {
  it("reverses each game and keeps the order of play", () => {
    expect(flipScoreDetail("11-8, 9-11, 11-6")).toBe("8-11, 11-9, 6-11");
  });

  it("leaves something it cannot parse alone rather than mangling it", () => {
    // Cards get typed by hand; "ret." and "w/o" turn up on real ones.
    expect(flipScoreDetail("11-8, ret.")).toBe("8-11, ret.");
  });

  it("handles double-figure scores, which deuce produces often", () => {
    expect(flipScoreDetail("13-11, 25-23")).toBe("11-13, 23-25");
  });
});
