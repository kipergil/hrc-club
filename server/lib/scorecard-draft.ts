import type {
  ScorecardDraft,
  ScorecardDraftRubber,
  ScorecardLineupSlot,
} from "../../shared/types.js";
import {
  AWAY_SLOTS,
  DOUBLES_RUBBER,
  HOME_SLOTS,
  RUBBERS_PER_MATCH,
  reviewScorecard,
  slotsForRubber,
  type AwaySlot,
  type HomeSlot,
  type ScorecardInput,
} from "../../shared/scorecard.js";
import { resolveName, splitPair, type Candidate } from "../../shared/name-match.js";
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
 * The shape follows the sheet: **six players, then ten rubbers.** A name is
 * resolved once against the letter it belongs to, and the printed pairing
 * order supplies every singles rubber from there. Matching each row
 * separately, as this used to, meant the same name was resolved three
 * times and could come out differently each time — and it made the editor
 * correct the same misread person in three places.
 *
 * Names are *offered*, never imposed: the id is filled in where the match
 * was unambiguous, the name as written is kept either way, and where a
 * name fits two players both are carried through so the form can ask.
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

  /**
   * The name for a letter: the line-up box first, then whatever the rows
   * for that letter happen to say.
   *
   * The fallback matters for a card whose box was left blank or unreadable
   * — the rows are then the only evidence of who played, and the printed
   * order says which rows belong to which letter.
   */
  function nameForSlot(slot: HomeSlot | AwaySlot, side: "home" | "away"): string | null {
    const box = side === "home" ? card?.homePlayers : card?.awayPlayers;
    const fromBox = (box as Record<string, string | null> | undefined)?.[slot];
    if (fromBox) return fromBox;

    for (let number = 1; number < DOUBLES_RUBBER; number += 1) {
      const slots = slotsForRubber(number);
      if (!slots) continue;
      const matches = side === "home" ? slots[0] === slot : slots[1] === slot;
      if (!matches) continue;
      const row = byNumber.get(number);
      const name = side === "home" ? row?.homePlayer : row?.awayPlayer;
      if (name) return name;
    }
    return null;
  }

  function lineup(side: "home" | "away"): ScorecardLineupSlot[] {
    const slots = side === "home" ? HOME_SLOTS : AWAY_SLOTS;
    const candidates = side === "home" ? homeCandidates : awayCandidates;
    return slots.map((slot) => {
      const name = nameForSlot(slot, side);
      const resolved = resolveName(name, candidates);
      return { slot, memberId: resolved.id, name, how: resolved.how, options: resolved.options };
    });
  }

  const homeLineup = lineup("home");
  const awayLineup = lineup("away");
  const homeBySlot = new Map(homeLineup.map((entry) => [entry.slot, entry]));
  const awayBySlot = new Map(awayLineup.map((entry) => [entry.slot, entry]));

  const rubbers: ScorecardDraftRubber[] = [];
  for (let number = 1; number <= RUBBERS_PER_MATCH; number += 1) {
    const source = byNumber.get(number);
    const isDoubles = number === DOUBLES_RUBBER;

    if (!isDoubles) {
      /*
       * A singles is entirely determined by its letters, so it takes its
       * players from the line-up and nothing else. Nobody edits a singles
       * player on the row; they edit the line-up and all three of that
       * player's rubbers follow.
       */
      const slots = slotsForRubber(number);
      const home = homeBySlot.get(slots?.[0] ?? "");
      const away = awayBySlot.get(slots?.[1] ?? "");
      rubbers.push({
        rubberNumber: number,
        kind: "singles",
        homePlayerId: home?.memberId ?? null,
        homePlayer2Id: null,
        awayPlayerId: away?.memberId ?? null,
        awayPlayer2Id: null,
        homePlayerName: home?.name ?? null,
        homePlayer2Name: null,
        awayPlayerName: away?.name ?? null,
        awayPlayer2Name: null,
        games: source?.games ?? [],
      });
      continue;
    }

    /*
     * The doubles is the one rubber the letters do not settle: any two of
     * the three may play it, so its pair is read from the card. A doubles
     * cell is often one string — "Trakru & Patel" — so it is split first.
     */
    const [homeA, homeB] = source?.homePlayer2
      ? [source.homePlayer, source.homePlayer2]
      : splitPair(source?.homePlayer);
    const [awayA, awayB] = source?.awayPlayer2
      ? [source.awayPlayer, source.awayPlayer2]
      : splitPair(source?.awayPlayer);

    rubbers.push({
      rubberNumber: number,
      kind: "doubles",
      homePlayerId: resolveName(homeA, homeCandidates).id,
      homePlayer2Id: resolveName(homeB, homeCandidates).id,
      awayPlayerId: resolveName(awayA, awayCandidates).id,
      awayPlayer2Id: resolveName(awayB, awayCandidates).id,
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

  /*
   * Unresolved names, reported against the line-up rather than against the
   * rubbers. One line about who "Sam" is beats the same sentence repeated
   * under rubbers 2, 7 and 9.
   */
  for (const [entries, side, squad] of [
    [homeLineup, "home", homeSquad],
    [awayLineup, "away", awaySquad],
  ] as const) {
    for (const entry of entries) {
      if (!entry.name || entry.memberId) continue;
      const named = entry.options
        .map((id) => squad.find((member) => member.id === id)?.fullName)
        .filter(Boolean);
      warnings.push({
        severity: "warning",
        rubberNumber: null,
        field: `${side}.${entry.slot}`,
        message:
          named.length > 0
            ? `${side === "home" ? "Home" : "Away"} player ${entry.slot}, "${entry.name}", could be ${named.join(" or ")}. Pick which.`
            : `${side === "home" ? "Home" : "Away"} player ${entry.slot}, "${entry.name}", is not in the squad for this match. Pick the player, or leave the name as written.`,
      });
    }
  }

  return {
    fixtureId,
    homeTeam: fixture.homeTeam,
    awayTeam: fixture.awayTeam,
    playedOn: card?.playedOn ?? fixture.playedOn,
    homeLineup,
    awayLineup,
    rubbers,
    warnings,
    homeSquad,
    awaySquad,
  };
}
