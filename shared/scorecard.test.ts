import { describe, expect, it } from "vitest";
import {
  DOUBLES_RUBBER,
  RUBBERS_PER_MATCH,
  SINGLES_ORDER,
  type ScorecardInput,
  checkPairings,
  checkScorecard,
  formatGames,
  hasBlockingError,
  isLegalGame,
  matchScoreOf,
  outcomeOf,
  parseGames,
  reviewScorecard,
  slotsForRubber,
} from "./scorecard.js";

/** A rubber won 3-0 by whichever side the caller says. */
function games(winner: "home" | "away", count = 3): Array<[number, number]> {
  const game: [number, number] = winner === "home" ? [11, 8] : [8, 11];
  return Array.from({ length: count }, () => [...game] as [number, number]);
}

function rubber(n: number, overrides: Partial<ScorecardInput["rubbers"][number]> = {}) {
  const slots = slotsForRubber(n);
  return {
    rubberNumber: n,
    homePlayer: slots ? `Home ${slots[0]}` : "Home A",
    homePlayer2: null,
    awayPlayer: slots ? `Away ${slots[1]}` : "Away X",
    awayPlayer2: null,
    games: games("home"),
    ...overrides,
  };
}

/** A complete, internally consistent card — home win 10-0 unless changed. */
function card(overrides: Partial<ScorecardInput> = {}): ScorecardInput {
  return {
    playedOn: "2026-09-23",
    homeTeamName: "HRC B",
    awayTeamName: "Water Lane A",
    startTime: "19:30",
    finishTime: "22:10",
    rubbers: Array.from({ length: RUBBERS_PER_MATCH }, (_, i) =>
      i + 1 === DOUBLES_RUBBER
        ? rubber(DOUBLES_RUBBER, {
            homePlayer: "Home A",
            homePlayer2: "Home B",
            awayPlayer: "Away X",
            awayPlayer2: "Away Y",
          })
        : rubber(i + 1),
    ),
    ...overrides,
  };
}

describe("the card's shape", () => {
  it("is nine singles and a doubles", () => {
    // Ten rubbers is why a team's points are out of ten a match, and why
    // 118 points from fourteen matches is a real number.
    expect(SINGLES_ORDER).toHaveLength(9);
    expect(RUBBERS_PER_MATCH).toBe(10);
    expect(DOUBLES_RUBBER).toBe(10);
  });

  it("pairs every home player against every away player exactly once", () => {
    const seen = SINGLES_ORDER.map(([home, away]) => `${home}${away}`);
    expect(new Set(seen).size).toBe(9);
  });

  it("keeps the league's printed order, which is not alphabetical", () => {
    // Read straight off SingleScoreCard.htm. Sorting these would give a
    // player two rubbers in a row, which is exactly what the order avoids.
    expect(SINGLES_ORDER.map(([h, a]) => `${h}-${a}`)).toEqual([
      "A-X", "B-Y", "C-Z", "B-X", "A-Z", "C-Y", "B-Z", "C-X", "A-Y",
    ]);
  });

  it("gives the doubles no fixed slots", () => {
    expect(slotsForRubber(DOUBLES_RUBBER)).toBeNull();
    expect(slotsForRubber(1)).toEqual(["A", "X"]);
  });
});

describe("isLegalGame", () => {
  it("accepts a game won at eleven", () => {
    expect(isLegalGame([11, 9])).toBe(true);
    expect(isLegalGame([11, 0])).toBe(true);
    expect(isLegalGame([7, 11])).toBe(true);
  });

  it("rejects eleven to ten, which cannot happen", () => {
    // Two clear points, so at 10-10 the game goes on. This is the single
    // most common misread digit on a photographed card.
    expect(isLegalGame([11, 10])).toBe(false);
  });

  it("accepts deuce, which runs past eleven", () => {
    expect(isLegalGame([12, 10])).toBe(true);
    expect(isLegalGame([13, 11])).toBe(true);
    expect(isLegalGame([25, 23])).toBe(true);
  });

  it("rejects a deuce that is not two clear", () => {
    expect(isLegalGame([13, 10])).toBe(false);
    expect(isLegalGame([15, 11])).toBe(false);
  });

  it("rejects a game nobody has won yet", () => {
    // A sheet photographed mid-match, which is worth saying out loud
    // rather than saving as a result.
    expect(isLegalGame([7, 3])).toBe(false);
    expect(isLegalGame([0, 0])).toBe(false);
  });
});

describe("outcomeOf", () => {
  it("counts games to sets", () => {
    expect(outcomeOf(games("home"))).toMatchObject({ homeSets: 3, awaySets: 0, winner: "home" });
  });

  it("handles a rubber that went the distance", () => {
    const five: Array<[number, number]> = [[11, 8], [9, 11], [11, 6], [8, 11], [11, 9]];
    expect(outcomeOf(five)).toMatchObject({ homeSets: 3, awaySets: 2, winner: "home", complete: true });
  });

  it("reports an unfinished rubber rather than guessing a winner", () => {
    expect(outcomeOf(games("home", 2))).toMatchObject({ complete: false, winner: "home" });
    expect(outcomeOf([])).toMatchObject({ winner: null, complete: false });
  });
});

describe("matchScoreOf", () => {
  it("is the count of rubbers won, which is the league points", () => {
    const rubbers = [
      ...Array.from({ length: 6 }, () => ({ games: games("home") })),
      ...Array.from({ length: 4 }, () => ({ games: games("away") })),
    ];
    expect(matchScoreOf(rubbers)).toEqual({ home: 6, away: 4 });
  });

  it("adds to ten on a complete card", () => {
    const score = matchScoreOf(card().rubbers);
    expect(score.home + score.away).toBe(RUBBERS_PER_MATCH);
  });

  it("does not award a rubber nobody finished", () => {
    expect(matchScoreOf([{ games: [] }])).toEqual({ home: 0, away: 0 });
  });
});

describe("checkScorecard", () => {
  it("passes a complete, consistent card", () => {
    expect(checkScorecard(card())).toEqual([]);
  });

  it("notices a missing rubber", () => {
    const short = card({ rubbers: card().rubbers.slice(0, 9) });
    const warnings = checkScorecard(short);
    expect(warnings.some((w) => w.message.includes("Rubber 10 is missing"))).toBe(true);
  });

  it("notices the same rubber entered twice, and calls it an error", () => {
    const doubled = card();
    doubled.rubbers.push(rubber(1));
    const warnings = checkScorecard(doubled);
    expect(warnings.some((w) => w.severity === "error" && w.message.includes("twice"))).toBe(true);
    expect(hasBlockingError(warnings)).toBe(true);
  });

  it("flags a game score that is not a finished game", () => {
    const bad = card();
    bad.rubbers[0]!.games = [[11, 10], [11, 8], [11, 8]];
    const warnings = checkScorecard(bad);
    const found = warnings.find((w) => w.field === "games.0");
    expect(found?.message).toContain("11-10");
    // A warning, not an error: a captain can look at the photo and fix it.
    expect(found?.severity).toBe("warning");
  });

  it("flags a rubber nobody won", () => {
    const unfinished = card();
    unfinished.rubbers[2]!.games = games("home", 2);
    expect(
      checkScorecard(unfinished).some((w) => w.message.includes("nobody has won it")),
    ).toBe(true);
  });

  it("refuses a singles with two players a side", () => {
    const bad = card();
    bad.rubbers[0]!.homePlayer2 = "Somebody Else";
    const warnings = checkScorecard(bad);
    expect(hasBlockingError(warnings)).toBe(true);
  });

  it("wants two names a side on the doubles", () => {
    const bad = card();
    bad.rubbers[DOUBLES_RUBBER - 1]!.awayPlayer2 = null;
    expect(
      checkScorecard(bad).some((w) => w.field === "awayPlayer2"),
    ).toBe(true);
  });

  it("reports everything wrong at once, not just the first thing", () => {
    // A card is reviewed by a person in one pass; giving them one problem
    // at a time turns that into five passes.
    const bad = card();
    bad.rubbers[0]!.games = [[11, 10]];
    bad.rubbers[1]!.homePlayer = null;
    bad.rubbers[2]!.games = [];
    expect(checkScorecard(bad).length).toBeGreaterThanOrEqual(3);
  });
});

describe("checkPairings", () => {
  it("works out who A, B, C, X, Y and Z are", () => {
    const { homeSlots, awaySlots, warnings } = checkPairings(card());
    expect(warnings).toEqual([]);
    expect(homeSlots).toEqual({ A: "Home A", B: "Home B", C: "Home C" });
    expect(awaySlots).toEqual({ X: "Away X", Y: "Away Y", Z: "Away Z" });
  });

  it("catches a name that disagrees with the card's fixed order", () => {
    /*
     * This is the check the printed order buys us. Rubber 1 is A-X and
     * rubber 4 is B-X, so the away player must be the same person in
     * both. A model that misreads one of them cannot make them agree, and
     * no amount of arithmetic would have noticed.
     */
    const misread = card();
    misread.rubbers[3]!.awayPlayer = "Awya X";
    const { warnings } = checkPairings(misread);
    expect(warnings).toHaveLength(1);
    expect(warnings[0]!.rubberNumber).toBe(4);
    expect(warnings[0]!.message).toContain("misread");
  });

  it("ignores case, because a card written in capitals is not a disagreement", () => {
    const shouty = card();
    shouty.rubbers[3]!.awayPlayer = "AWAY X";
    expect(checkPairings(shouty).warnings).toEqual([]);
  });

  it("does not try to place the doubles, which has no fixed slots", () => {
    const { homeSlots } = checkPairings(card());
    // The doubles pair is A and B here; it must not overwrite either slot.
    expect(homeSlots.A).toBe("Home A");
  });
});

describe("reviewScorecard", () => {
  it("passes a good card and blocks nothing", () => {
    const warnings = reviewScorecard(card());
    expect(warnings).toEqual([]);
    expect(hasBlockingError(warnings)).toBe(false);
  });

  it("gathers structural and pairing problems together", () => {
    const bad = card();
    bad.rubbers[3]!.awayPlayer = "Someone Different";
    bad.rubbers[5]!.games = [[11, 10]];
    const warnings = reviewScorecard(bad);
    expect(warnings.some((w) => w.message.includes("misread"))).toBe(true);
    expect(warnings.some((w) => w.message.includes("11-10"))).toBe(true);
    // Neither is fatal — a person can fix both in the form.
    expect(hasBlockingError(warnings)).toBe(false);
  });
});

describe("parseGames", () => {
  it("reads the way a score is written", () => {
    expect(parseGames("11-8, 9-11, 11-6").games).toEqual([[11, 8], [9, 11], [11, 6]]);
  });

  it("accepts whatever separator came to hand", () => {
    // Somebody typing at speed on a phone uses whichever is nearest.
    expect(parseGames("11-8 9-11").games).toHaveLength(2);
    expect(parseGames("11–8; 9—11").games).toEqual([[11, 8], [9, 11]]);
    expect(parseGames("11/8, 9:11").games).toEqual([[11, 8], [9, 11]]);
  });

  it("reports what it could not read rather than dropping it", () => {
    // Silently ignoring "eleven-eight" would save a card missing a game.
    const { games, invalid } = parseGames("11-8, eleven-eight, 9-11");
    expect(games).toEqual([[11, 8], [9, 11]]);
    expect(invalid).toEqual(["eleven-eight"]);
  });

  it("refuses a sixth game, because best of five has five", () => {
    const { games, invalid } = parseGames("11-1 11-1 11-1 11-1 11-1 11-1");
    expect(games).toHaveLength(5);
    expect(invalid).toEqual(["11-1"]);
  });

  it("copes with an empty field", () => {
    expect(parseGames("")).toEqual({ games: [], invalid: [] });
    expect(parseGames("   ")).toEqual({ games: [], invalid: [] });
  });

  it("round-trips through formatGames", () => {
    const games: Array<[number, number]> = [[11, 8], [9, 11], [12, 10]];
    expect(parseGames(formatGames(games)).games).toEqual(games);
  });
});
