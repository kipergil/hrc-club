import { z } from "zod";
import { sameName } from "./name-match.js";

/**
 * The league's own scorecard, as a data structure.
 *
 * Taken from `SingleScoreCard.htm` on hertsttl.org.uk, which is the sheet
 * captains actually fill in on the night. Its shape is not a convention
 * this site invented and is not ours to change:
 *
 *   - Three players a side. Home are **A, B, C**; away are **X, Y, Z**.
 *   - **Nine singles in a fixed printed order**, then a **doubles**.
 *   - Each rubber is best of five games; the card has five columns for
 *     them and a SETS column at the end.
 *   - Ten rubbers, so a match is out of ten and a team's league points
 *     are the rubbers it won. That is what makes 118 points from
 *     fourteen matches a real number rather than a typo.
 *
 * Everything here is pure and tested, and that is the point. A scorecard
 * read off a photograph by a model is a guess until something checks it,
 * and the card is rigid enough to check hard: the pairings are known
 * before anyone reads the page, the games must sum to the sets, and the
 * sets must sum to the match score. What survives all three is very
 * unlikely to be wrong in a way that matters; what fails any of them is
 * shown to a human rather than saved.
 */

/** Home players, as the card labels them. */
export const HOME_SLOTS = ["A", "B", "C"] as const;
/** Away players, as the card labels them. */
export const AWAY_SLOTS = ["X", "Y", "Z"] as const;

export type HomeSlot = (typeof HOME_SLOTS)[number];
export type AwaySlot = (typeof AWAY_SLOTS)[number];

/**
 * The nine singles, in the order the card prints them.
 *
 * Not alphabetical, and not A-X, A-Y, A-Z: the league interleaves them so
 * that no player has two matches in a row. Rubber 10 is the doubles and
 * has no fixed slots, so it is not in this list.
 */
export const SINGLES_ORDER: ReadonlyArray<readonly [HomeSlot, AwaySlot]> = [
  ["A", "X"],
  ["B", "Y"],
  ["C", "Z"],
  ["B", "X"],
  ["A", "Z"],
  ["C", "Y"],
  ["B", "Z"],
  ["C", "X"],
  ["A", "Y"],
] as const;

/** Nine singles plus the doubles. */
export const RUBBERS_PER_MATCH = SINGLES_ORDER.length + 1;
export const DOUBLES_RUBBER = RUBBERS_PER_MATCH;

/** Which slots rubber `n` (1-based) is between, or null for the doubles. */
export function slotsForRubber(rubberNumber: number): readonly [HomeSlot, AwaySlot] | null {
  return SINGLES_ORDER[rubberNumber - 1] ?? null;
}

// ---------------------------------------------------------------------------
// The shape a parsed or hand-entered card arrives in
// ---------------------------------------------------------------------------

/**
 * One game: points to the home side, then the away side.
 *
 * A tuple rather than an object because that is how it is written on the
 * card and said out loud — "eleven-eight" — and because a `{home, away}`
 * object invites somebody to fill in one half.
 */
export const gameSchema = z.tuple([z.number().int().min(0).max(99), z.number().int().min(0).max(99)]);
export type Game = z.infer<typeof gameSchema>;

export const rubberInputSchema = z.object({
  rubberNumber: z.number().int().min(1).max(RUBBERS_PER_MATCH),
  /** Names exactly as written on the card. Matching them to members happens later. */
  homePlayer: z.string().trim().max(120).nullable(),
  homePlayer2: z.string().trim().max(120).nullable(),
  awayPlayer: z.string().trim().max(120).nullable(),
  awayPlayer2: z.string().trim().max(120).nullable(),
  games: z.array(gameSchema).max(5),
});
export type RubberInput = z.infer<typeof rubberInputSchema>;

const playerNameSchema = z.string().trim().max(120).nullable();

/**
 * The line-up box at the top of the sheet.
 *
 * The card names its three players a side **once**, against the letters,
 * and then the nine singles rows refer to the letters alone. Reading it
 * that way rather than re-reading a name in every row is the whole
 * difference between six names to check and eighteen: the pairing order is
 * printed, so A/B/C and X/Y/Z determine every singles rubber's players
 * outright.
 *
 * Optional because a card can be typed in from nothing, and because a
 * photograph of a sheet whose line-up box was left blank is still a card
 * worth reading — the names then come from the rows, as they used to.
 */
export const homeLineupSchema = z
  .object({ A: playerNameSchema, B: playerNameSchema, C: playerNameSchema })
  .default({ A: null, B: null, C: null });
export const awayLineupSchema = z
  .object({ X: playerNameSchema, Y: playerNameSchema, Z: playerNameSchema })
  .default({ X: null, Y: null, Z: null });

export type HomeLineup = z.infer<typeof homeLineupSchema>;
export type AwayLineup = z.infer<typeof awayLineupSchema>;

export const scorecardInputSchema = z.object({
  playedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  homeTeamName: z.string().trim().max(120).nullable(),
  awayTeamName: z.string().trim().max(120).nullable(),
  startTime: z.string().trim().max(20).nullable(),
  finishTime: z.string().trim().max(20).nullable(),
  homePlayers: homeLineupSchema,
  awayPlayers: awayLineupSchema,
  rubbers: z.array(rubberInputSchema),
});
export type ScorecardInput = z.infer<typeof scorecardInputSchema>;

/** The name the card gives for one slot, from the line-up box. */
export function lineupName(
  card: ScorecardInput,
  side: "home" | "away",
  slot: HomeSlot | AwaySlot,
): string | null {
  const box: Record<string, string | null> =
    side === "home" ? card.homePlayers : card.awayPlayers;
  return box[slot] ?? null;
}

// ---------------------------------------------------------------------------
// Scoring
// ---------------------------------------------------------------------------

export interface RubberOutcome {
  homeSets: number;
  awaySets: number;
  /** Null while the rubber has no games on it at all. */
  winner: "home" | "away" | null;
  complete: boolean;
}

/**
 * A game is won at 11, except that it must be won by two clear points, so
 * deuce runs 12-10, 13-11 and upwards. Both are checked because the two
 * failures look completely different on a photographed card: an 11-10 is
 * usually a misread digit, and a 7-3 is usually a game that was still in
 * progress when somebody photographed the sheet.
 */
export function isLegalGame([home, away]: Game): boolean {
  const high = Math.max(home, away);
  const low = Math.min(home, away);
  if (high < 11) return false;
  if (high === 11) return low <= 9;
  // Past 11 the game only continues at deuce, so it ends exactly two clear.
  return high - low === 2;
}

/** Best of five: the rubber ends when somebody reaches three games. */
export function outcomeOf(games: Game[]): RubberOutcome {
  let homeSets = 0;
  let awaySets = 0;
  for (const [home, away] of games) {
    if (home > away) homeSets += 1;
    else if (away > home) awaySets += 1;
  }
  const winner = homeSets > awaySets ? "home" : awaySets > homeSets ? "away" : null;
  return { homeSets, awaySets, winner, complete: homeSets === 3 || awaySets === 3 };
}

export interface MatchScore {
  home: number;
  away: number;
}

/** The match score: rubbers won, which is also the league points. */
export function matchScoreOf(rubbers: Array<{ games: Game[] }>): MatchScore {
  let home = 0;
  let away = 0;
  for (const rubber of rubbers) {
    const { winner } = outcomeOf(rubber.games);
    if (winner === "home") home += 1;
    else if (winner === "away") away += 1;
  }
  return { home, away };
}

// ---------------------------------------------------------------------------
// Checking a card
// ---------------------------------------------------------------------------

export type WarningSeverity = "error" | "warning";

export interface CardWarning {
  severity: WarningSeverity;
  /** Which rubber it concerns, so the form can put it beside that row. */
  rubberNumber: number | null;
  field: string | null;
  message: string;
}

/**
 * Everything wrong with a card, rather than the first thing wrong with it.
 *
 * `error` means the card cannot be saved as it stands; `warning` means it
 * can, but somebody should look. The distinction matters because a
 * photographed card is often *slightly* wrong in ways a human can resolve
 * in two seconds — a name the model spelled from a scrawl — and refusing
 * the whole card for that would send the captain back to typing it out by
 * hand, which is the thing this feature exists to avoid.
 */
export function checkScorecard(card: ScorecardInput): CardWarning[] {
  const warnings: CardWarning[] = [];
  const add = (
    severity: WarningSeverity,
    rubberNumber: number | null,
    field: string | null,
    message: string,
  ) => warnings.push({ severity, rubberNumber, field, message });

  const seen = new Set<number>();
  for (const rubber of card.rubbers) {
    if (seen.has(rubber.rubberNumber)) {
      add("error", rubber.rubberNumber, null, `Match ${rubber.rubberNumber} on the card appears twice.`);
    }
    seen.add(rubber.rubberNumber);
  }

  for (let n = 1; n <= RUBBERS_PER_MATCH; n += 1) {
    if (!seen.has(n)) {
      add("warning", n, null, `Match ${n} on the card has nothing on it.`);
    }
  }

  for (const rubber of card.rubbers) {
    const isDoubles = rubber.rubberNumber === DOUBLES_RUBBER;
    /*
     * "Match N on the card", not "Rubber N". A rubber is the right word
     * for one singles inside a team match, but in table tennis it much
     * more often means the sheet on the bat — and the league's own site
     * never uses it, so it is jargon this site would be introducing
     * rather than jargon it is keeping.
     */
    const prefix = isDoubles ? "The doubles" : `Match ${rubber.rubberNumber} on the card`;

    if (!rubber.homePlayer) {
      add("warning", rubber.rubberNumber, "homePlayer", `${prefix} has no home player named.`);
    }
    if (!rubber.awayPlayer) {
      add("warning", rubber.rubberNumber, "awayPlayer", `${prefix} has no away player named.`);
    }

    if (isDoubles) {
      if (!rubber.homePlayer2) {
        add("warning", rubber.rubberNumber, "homePlayer2", "The doubles has only one home player named.");
      }
      if (!rubber.awayPlayer2) {
        add("warning", rubber.rubberNumber, "awayPlayer2", "The doubles has only one away player named.");
      }
    } else if (rubber.homePlayer2 || rubber.awayPlayer2) {
      add(
        "error",
        rubber.rubberNumber,
        "homePlayer2",
        `${prefix} is a singles and cannot have two players a side.`,
      );
    }

    for (const [index, game] of rubber.games.entries()) {
      if (!isLegalGame(game)) {
        add(
          "warning",
          rubber.rubberNumber,
          `games.${index}`,
          `${prefix}, game ${index + 1} reads ${game[0]}-${game[1]}, which is not a finished game — 11 up, two clear.`,
        );
      }
    }

    const outcome = outcomeOf(rubber.games);
    if (rubber.games.length > 0 && !outcome.complete) {
      add(
        "warning",
        rubber.rubberNumber,
        "games",
        `${prefix} is ${outcome.homeSets}-${outcome.awaySets} in games, so nobody has won it.`,
      );
    }
    if (outcome.homeSets > 3 || outcome.awaySets > 3) {
      add("error", rubber.rubberNumber, "games", `${prefix} has more than three games to one side.`);
    }
  }

  return warnings;
}

/**
 * Do the named players line up with the card's fixed pairing order?
 *
 * The nine singles always run A-X, B-Y, C-Z, B-X, A-Z, C-Y, B-Z, C-X,
 * A-Y, so once three home names and three away names are known, every
 * singles pairing is known too — and a card that disagrees with that has
 * been misread. This is the strongest check available and it costs
 * nothing, because the order is printed on the sheet rather than decided
 * on the night.
 *
 * Returns a warning per disagreement, and a `slots` map of the names the
 * card implies for A/B/C and X/Y/Z.
 */
export function checkPairings(card: ScorecardInput): {
  warnings: CardWarning[];
  homeSlots: Partial<Record<HomeSlot, string>>;
  awaySlots: Partial<Record<AwaySlot, string>>;
} {
  const homeSlots: Partial<Record<HomeSlot, string>> = {};
  const awaySlots: Partial<Record<AwaySlot, string>> = {};
  const warnings: CardWarning[] = [];

  /*
   * The line-up box first, so it is what the rows are checked against
   * rather than merely another opinion. Where the card names its players
   * against the letters, that is the card telling you who A is; a row
   * saying somebody else is the misreading, and this is the direction the
   * disagreement should be reported in.
   */
  for (const slot of HOME_SLOTS) {
    const name = card.homePlayers?.[slot];
    if (name) homeSlots[slot] = name;
  }
  for (const slot of AWAY_SLOTS) {
    const name = card.awayPlayers?.[slot];
    if (name) awaySlots[slot] = name;
  }

  for (const rubber of card.rubbers) {
    const slots = slotsForRubber(rubber.rubberNumber);
    if (!slots) continue;
    const [homeSlot, awaySlot] = slots;

    for (const [name, slot, map, side] of [
      [rubber.homePlayer, homeSlot, homeSlots, "home"],
      [rubber.awayPlayer, awaySlot, awaySlots, "away"],
    ] as const) {
      if (!name) continue;
      const existing = (map as Record<string, string | undefined>)[slot];
      if (existing === undefined) {
        (map as Record<string, string>)[slot] = name;
      } else if (sameName(existing, name)) {
        /*
         * The same player, written more or less fully. Keep whichever
         * writing says more: with no line-up box, the slot is whatever the
         * first row happened to call them, and "Sandy" is worth replacing
         * with "Sandy Nash" the moment a later row supplies it.
         */
        if (name.trim().split(/\s+/).length > existing.trim().split(/\s+/).length) {
          (map as Record<string, string>)[slot] = name;
        }
      } else {
        warnings.push({
          severity: "warning",
          rubberNumber: rubber.rubberNumber,
          field: side === "home" ? "homePlayer" : "awayPlayer",
          message:
            `The card puts ${side} player ${slot} as "${existing}" elsewhere but "${name}" here. ` +
            "One of the two has been misread.",
        });
      }
    }
  }

  return { warnings, homeSlots, awaySlots };
}

/** Everything wrong with the card, structure and pairings together. */
export function reviewScorecard(card: ScorecardInput): CardWarning[] {
  return [...checkScorecard(card), ...checkPairings(card).warnings];
}

export function hasBlockingError(warnings: CardWarning[]): boolean {
  return warnings.some((warning) => warning.severity === "error");
}

// ---------------------------------------------------------------------------
// Typing a card in
// ---------------------------------------------------------------------------

/**
 * Games as one line of text — "11-8, 9-11, 11-6".
 *
 * Ten numeric inputs a row, a hundred to a card, is a form nobody would
 * finish. This is how the scores are said out loud and written on the
 * sheet, so it is how they are typed: one field a rubber, separators
 * forgiving, and the sets worked out live from what has been entered.
 */
export function formatGames(games: Game[]): string {
  return games.map(([home, away]) => `${home}-${away}`).join(", ");
}

export interface ParsedGames {
  games: Game[];
  /** The fragments that were not a game, so the field can say which. */
  invalid: string[];
}

export function parseGames(text: string): ParsedGames {
  const games: Game[] = [];
  const invalid: string[] = [];

  // Commas, spaces and semicolons all separate; en-dashes and slashes all
  // join. A person typing quickly uses whichever is nearest.
  for (const chunk of text.split(/[,;\s]+/).filter(Boolean)) {
    const match = chunk.match(/^(\d{1,2})\s*[-–—/:]\s*(\d{1,2})$/);
    if (!match) {
      invalid.push(chunk);
      continue;
    }
    if (games.length >= 5) {
      invalid.push(chunk);
      continue;
    }
    games.push([Number(match[1]), Number(match[2])]);
  }

  return { games, invalid };
}
