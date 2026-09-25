import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DOUBLES_RUBBER,
  SINGLES_ORDER,
  matchScoreOf,
  outcomeOf,
  reviewScorecard,
} from "../../../shared/scorecard.js";
import { parseScorecardPage } from "./parse-scorecard-page.js";

/**
 * The five cards the league had posted on 25 September 2026 — the first
 * week of the season — captured whole from `ScoreCard.asp?LMID=…`.
 *
 * Between them they cover the shapes a card takes: a 5-5 draw, a 10-0 and
 * a 0-10 whitewash, a 3-7 and a 6-4; singles going three, four and five
 * games; a doubles decided 13-11 in the fifth; and three players playing
 * up from a lower team. Real cards rather than hand-made ones, because the
 * mistakes worth catching are the ones the league's markup actually
 * provokes.
 */
function card(lmid: number) {
  const file = path.join(import.meta.dirname, `__fixtures__/scorecard-${lmid}.htm`);
  return parseScorecardPage(new TextDecoder("windows-1252").decode(readFileSync(file)));
}

const ALL = [487, 473, 506, 567, 575] as const;

describe("reading a posted card", () => {
  it("reads the teams, the night and the division off the top of the card", () => {
    const hrcA = card(487);
    expect(hrcA.card.homeTeamName).toBe("HRC A");
    expect(hrcA.card.awayTeamName).toBe("Ellenborough A");
    // The night it was played, which is not the Monday the week is named for.
    expect(hrcA.card.playedOn).toBe("2026-09-23");
    expect(hrcA.division).toBe("Premier");
  });

  it("puts each of the six players against their letter", () => {
    expect(card(487).card.homePlayers).toEqual({
      A: "Chris Wade",
      B: "Kai Drake",
      C: "Derek Balding",
    });
    expect(card(487).card.awayPlayers).toEqual({
      X: "Alan Pearse",
      Y: "Simon Conway",
      Z: "Albert Francis",
    });
  });

  it("reads every game of a match, and stops where the match did", () => {
    const rubbers = card(487).card.rubbers;
    // A-X went to five; C-Z was over in three and the card shows blanks.
    expect(rubbers[0]!.games).toEqual([[10, 12], [11, 7], [11, 7], [8, 11], [7, 11]]);
    expect(rubbers[2]!.games).toEqual([[11, 5], [11, 4], [13, 11]]);
  });

  it("names the doubles pair from the letters the card gives", () => {
    // The card prints "A & C" and "Y & Z", not names.
    expect(card(487).card.rubbers[9]).toMatchObject({
      rubberNumber: DOUBLES_RUBBER,
      homePlayer: "Chris Wade",
      homePlayer2: "Derek Balding",
      awayPlayer: "Simon Conway",
      awayPlayer2: "Albert Francis",
    });
  });

  it("keeps who posted it, and when", () => {
    expect(card(487)).toMatchObject({ postedBy: "Neil S", postedAt: "24 Sep 2026 at 11:04" });
  });
});

describe("every captured card, checked against itself", () => {
  /*
   * The strongest check available: the card prints its own final result,
   * and a Sets column on every match. What the parser read from the games
   * has to produce both. A card that parsed "cleanly" with one game
   * transposed would fail here and nowhere else.
   */
  it.each(ALL)("LMID %i adds up to the result the league printed", (lmid) => {
    const parsed = card(lmid);
    const derived = matchScoreOf(parsed.card.rubbers);
    expect([derived.home, derived.away]).toEqual(parsed.finalResult);
  });

  it.each(ALL)("LMID %i has every match won by the side the league recorded", (lmid) => {
    const parsed = card(lmid);
    parsed.card.rubbers.forEach((rubber, index) => {
      const { homeSets, awaySets } = outcomeOf(rubber.games);
      const recorded = parsed.matchResults[index]!;
      expect(homeSets > awaySets, `match ${rubber.rubberNumber}`).toBe(recorded[0] > recorded[1]);
    });
  });

  it.each(ALL)("LMID %i has ten matches in the league's printed order", (lmid) => {
    const parsed = card(lmid);
    expect(parsed.card.rubbers.map((rubber) => rubber.rubberNumber)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(parsed.problems).toEqual([]);
    // And the singles really are A-X, B-Y, C-Z… — a name on row n belongs
    // to the letter the league's order puts there.
    parsed.card.rubbers.slice(0, 9).forEach((rubber, index) => {
      const [homeSlot, awaySlot] = SINGLES_ORDER[index]!;
      expect(rubber.homePlayer).toBe(parsed.card.homePlayers[homeSlot]);
      expect(rubber.awayPlayer).toBe(parsed.card.awayPlayers[awaySlot]);
    });
  });

  it.each(ALL)("LMID %i passes the checks a card entered on this site gets", (lmid) => {
    // The same `reviewScorecard` the admin screen runs before it will save.
    expect(reviewScorecard(card(lmid).card)).toEqual([]);
  });
});

describe("what the parser refuses to guess", () => {
  const source = new TextDecoder("windows-1252").decode(
    readFileSync(path.join(import.meta.dirname, "__fixtures__/scorecard-487.htm")),
  );

  it("reports a letter that turns up against two different names", () => {
    // Change B's name on one row only — the league's form allows it, and
    // it is the mistake that credits a match to the wrong player.
    const once = source.replace(/(B &nbsp;[\s\S]*?<font color=Navy>\s*)Kai Drake/, "$1Kai Drake-Smith");
    const parsed = parseScorecardPage(once);
    expect(parsed.problems.join(" ")).toMatch(/B is .* in one match and .* in match/);
  });

  it("reports a card with no final result rather than inventing one", () => {
    const parsed = parseScorecardPage(source.replace(/Final Result/, "Something Else"));
    expect(parsed.finalResult).toBeNull();
    expect(parsed.problems).toContain("No final result on the card.");
  });

  it("reports a card with rows missing", () => {
    const parsed = parseScorecardPage(source.replace(/Doubles:/, "Nothing:"));
    expect(parsed.problems).toContain("There is no doubles row.");
  });
});
