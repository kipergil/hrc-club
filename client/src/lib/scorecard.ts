import type { Rubber } from "@shared/types.js";

/**
 * Turning a scorecard row round.
 *
 * `hrc_rubbers` records one side and measures everything from it:
 * `member` is a player, `sets_for` and `won` are theirs, and
 * `score_detail` is written from where they stood. That was right when
 * this was one club's site and there was only ever one side worth
 * recording.
 *
 * The card is printed in the fixture's home and away columns, under a
 * scoreline that reads home-first. So every away row has to be turned
 * round on the way out, and turning *half* of it round is worse than
 * turning none: a row that reads "3–0" beside "8-11, 6-11, 9-11" states
 * the opposite result twice in the same line, and looks like a rendering
 * glitch rather than a lie about who won.
 *
 * Pure and tested for that reason — the wrongness is quiet, and only
 * visible to someone who reads a card closely enough to notice the games
 * disagree with the sets.
 */

export interface OrientedRubber {
  number: number;
  home: { name: string | null; slug: string | null };
  away: { name: string | null; slug: string | null };
  homeSets: number;
  awaySets: number;
  homeWon: boolean;
  /** Game scores, home-first, or null where the card did not record them. */
  scoreDetail: string | null;
}

/** Reverses each game in a detail string: "11-8, 9-11" → "8-11, 11-9". */
export function flipScoreDetail(detail: string): string {
  return detail
    .split(",")
    .map((game) => {
      const trimmed = game.trim();
      const [a, b] = trimmed.split("-");
      return a !== undefined && b !== undefined ? `${b}-${a}` : trimmed;
    })
    .join(", ");
}

export function orientRubber(rubber: Rubber): OrientedRubber {
  const member = { name: rubber.memberName, slug: rubber.memberSlug };
  const opponent = { name: rubber.opponentPlayerName, slug: null };

  const homeSets = rubber.memberIsHome ? rubber.setsFor : rubber.setsAgainst;
  const awaySets = rubber.memberIsHome ? rubber.setsAgainst : rubber.setsFor;

  return {
    number: rubber.rubberNumber,
    home: rubber.memberIsHome ? member : opponent,
    away: rubber.memberIsHome ? opponent : member,
    homeSets,
    awaySets,
    homeWon: homeSets > awaySets,
    scoreDetail:
      rubber.scoreDetail === null
        ? null
        : rubber.memberIsHome
          ? rubber.scoreDetail
          : flipScoreDetail(rubber.scoreDetail),
  };
}
