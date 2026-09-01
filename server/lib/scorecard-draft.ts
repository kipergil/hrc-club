import type { ScorecardDraft, ScorecardDraftRubber } from "../../shared/types.js";
import {
  DOUBLES_RUBBER,
  RUBBERS_PER_MATCH,
  reviewScorecard,
  type ScorecardInput,
} from "../../shared/scorecard.js";
import { matchName, splitPair, type Candidate } from "../../shared/name-match.js";
import * as storage from "../storage.js";

/**
 * Turns a read card — or nothing at all — into the draft the review
 * screen edits.
 *
 * One function for both, because a blank card and a parsed one are the
 * same screen with different values in it. Manual entry is not a separate
 * feature here; it is this feature with the first step skipped, which is
 * why it keeps working when there is no API key.
 *
 * Names are matched against the two squads and the result is *offered*,
 * never imposed: the id is filled in where the match was unambiguous, and
 * the name as written is kept either way so the form can show what the
 * card actually said next to who it was taken to mean.
 */
export async function buildDraft(
  fixtureId: string,
  card: ScorecardInput | null,
): Promise<ScorecardDraft | null> {
  const { fixture, homeSquad, awaySquad } = await storage.getFixtureSquads(fixtureId);
  if (!fixture) return null;

  const homeCandidates: Candidate[] = homeSquad.map((member) => ({
    id: member.id,
    fullName: member.fullName,
  }));
  const awayCandidates: Candidate[] = awaySquad.map((member) => ({
    id: member.id,
    fullName: member.fullName,
  }));

  const byNumber = new Map(card?.rubbers.map((rubber) => [rubber.rubberNumber, rubber]) ?? []);

  const rubbers: ScorecardDraftRubber[] = [];
  for (let number = 1; number <= RUBBERS_PER_MATCH; number += 1) {
    const source = byNumber.get(number);
    const isDoubles = number === DOUBLES_RUBBER;

    /*
     * A doubles cell is often one string — "Trakru & Patel" — so it is
     * split before matching. On a singles the same split is harmless:
     * there is nothing to split, and a name containing "and" is left
     * alone by the word boundary in `splitPair`.
     */
    const [homeA, homeB] = isDoubles
      ? source?.homePlayer2
        ? [source.homePlayer, source.homePlayer2]
        : splitPair(source?.homePlayer)
      : [source?.homePlayer ?? null, null];
    const [awayA, awayB] = isDoubles
      ? source?.awayPlayer2
        ? [source.awayPlayer, source.awayPlayer2]
        : splitPair(source?.awayPlayer)
      : [source?.awayPlayer ?? null, null];

    rubbers.push({
      rubberNumber: number,
      kind: isDoubles ? "doubles" : "singles",
      homePlayerId: matchName(homeA, homeCandidates)?.id ?? null,
      homePlayer2Id: matchName(homeB, homeCandidates)?.id ?? null,
      awayPlayerId: matchName(awayA, awayCandidates)?.id ?? null,
      awayPlayer2Id: matchName(awayB, awayCandidates)?.id ?? null,
      homePlayerName: homeA ?? null,
      homePlayer2Name: homeB ?? null,
      awayPlayerName: awayA ?? null,
      awayPlayer2Name: awayB ?? null,
      games: source?.games ?? [],
    });
  }

  /*
   * The checks run on the card as read, not on the draft. A blank card
   * would otherwise come back covered in "rubber 1 is missing", which is
   * true and useless — nobody has filled it in yet.
   */
  const warnings = card ? reviewScorecard(card) : [];

  // Names the card gave that no squad player answers to. Worth saying:
  // it is how a played-up reserve shows up, and how a misread name does.
  for (const rubber of rubbers) {
    for (const [name, id, field] of [
      [rubber.homePlayerName, rubber.homePlayerId, "homePlayer"],
      [rubber.awayPlayerName, rubber.awayPlayerId, "awayPlayer"],
    ] as const) {
      if (name && !id) {
        warnings.push({
          severity: "warning",
          rubberNumber: rubber.rubberNumber,
          field,
          message: `"${name}" is not in the squad for this match. Pick the player, or leave the name as written.`,
        });
      }
    }
  }

  return {
    fixtureId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    playedOn: card?.playedOn ?? fixture.playedOn,
    rubbers,
    warnings,
    homeSquad,
    awaySquad,
  };
}
