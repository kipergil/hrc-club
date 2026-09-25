import type { Division } from "./enums.js";

/**
 * The averages, worked out from the match cards.
 *
 * The league publishes a table of Name / Played / Won / Lost / %, greying
 * out anyone who has "played less than 50% of matches". Three things
 * about it were read off the league's own 2025-26 page rather than
 * assumed, because each one changes the arithmetic:
 *
 *  - **Played counts singles rubbers, not matches.** A player turns out
 *    for three singles a match, so a full fourteen-match season is 42.
 *    The highest figure on that page is 44 — more than a season's
 *    singles — which is a player who also played up for another team.
 *  - **The doubles is not in it.** Including it would put a full season
 *    at 56 and nothing on the page comes near that.
 *  - **Won + Lost equals Played on all 147 rows.** A rubber cannot be
 *    drawn, so there is no third column and no rounding to reconcile.
 *
 * Derived rather than imported, now that the cards hold every rubber.
 * That means a player's average changes the moment a card is entered and
 * cannot drift from the results it is built out of — the same reason the
 * league table is derived from fixtures rather than typed in.
 */

/** One match from one player's side, as the averages care about it. */
export interface AverageSource {
  memberId: string;
  memberName: string;
  memberSlug: string;
  /** The doubles is counted on its own and never moves the average. */
  kind: "singles" | "doubles";
  won: boolean;
  /** Games won and lost within the match, from this player's side. Optional for older callers. */
  setsFor?: number;
  setsAgainst?: number;
  /** Distinct fixtures are what "matches played" counts. */
  fixtureId: string;
  teamName: string | null;
  teamSlug: string | null;
  division: Division | null;
}

/**
 * A player's record — the same set of numbers wherever it is shown.
 *
 * The averages page and a player's own page used to count separately: the
 * server built one, the page built the other from the player's matches.
 * Two definitions of "played" are one too many, so both now come from
 * `recordOf` and cannot disagree.
 *
 * Everything but the doubles columns counts singles only, which is the
 * league's rule: the doubles is a pair's result, not a player's. It is
 * still counted — on its own, where it cannot move anybody's average.
 */
export interface PlayerRecord {
  /** Singles. */
  played: number;
  won: number;
  lost: number;
  /** Whole percent, as the league prints it. Null when no singles were played. */
  winPercentage: number | null;
  doublesPlayed: number;
  doublesWon: number;
  /** Games won and lost across their singles — the Sets column on a card. */
  setsFor: number;
  setsAgainst: number;
}

/** One match as a player's record counts it. */
export interface RecordSource {
  kind: "singles" | "doubles";
  won: boolean;
  setsFor?: number;
  setsAgainst?: number;
}

export function recordOf(matches: RecordSource[]): PlayerRecord {
  const record: PlayerRecord = {
    played: 0,
    won: 0,
    lost: 0,
    winPercentage: null,
    doublesPlayed: 0,
    doublesWon: 0,
    setsFor: 0,
    setsAgainst: 0,
  };
  for (const match of matches) {
    if (match.kind === "doubles") {
      record.doublesPlayed += 1;
      if (match.won) record.doublesWon += 1;
      continue;
    }
    record.played += 1;
    if (match.won) record.won += 1;
    else record.lost += 1;
    record.setsFor += match.setsFor ?? 0;
    record.setsAgainst += match.setsAgainst ?? 0;
  }
  record.winPercentage =
    record.played === 0 ? null : Math.round((record.won / record.played) * 100);
  return record;
}

export interface AverageRow extends PlayerRecord {
  memberId: string;
  memberName: string;
  memberSlug: string;
  teamName: string | null;
  /** The same team the name refers to — see where it is set below. */
  teamSlug: string | null;
  division: Division | null;
  matchesPlayed: number;
  /** The league's 50%-of-matches rule: below it, listed but not placed. */
  meetsParticipationThreshold: boolean;
}

/**
 * How many matches each team played, which the 50% rule is measured
 * against. Keyed by team slug.
 */
export type TeamMatchCounts = Record<string, number>;

export function buildAverages(
  rubbers: AverageSource[],
  teamMatches: TeamMatchCounts = {},
): AverageRow[] {
  interface Accumulator {
    memberId: string;
    memberName: string;
    memberSlug: string;
    first: { teamName: string | null; teamSlug: string | null; division: Division | null };
    matches: RecordSource[];
    fixtures: Set<string>;
    /** Singles played for each team, so the main team is the one they played most for. */
    byTeam: Map<string, { name: string | null; division: Division | null; count: number }>;
  }

  const players = new Map<string, Accumulator>();
  const entryFor = (rubber: AverageSource): Accumulator => {
    let entry = players.get(rubber.memberId);
    if (!entry) {
      entry = {
        memberId: rubber.memberId,
        memberName: rubber.memberName,
        memberSlug: rubber.memberSlug,
        first: { teamName: rubber.teamName, teamSlug: rubber.teamSlug, division: rubber.division },
        matches: [],
        fixtures: new Set(),
        byTeam: new Map(),
      };
      players.set(rubber.memberId, entry);
    }
    return entry;
  };

  for (const rubber of rubbers) {
    if (!rubber.memberId) continue;
    const entry = entryFor(rubber);
    entry.matches.push(rubber);
    // Only the singles decide which team a player is placed with and how
    // many matches they turned out in — the doubles never moves anybody.
    if (rubber.kind !== "singles") continue;
    entry.fixtures.add(rubber.fixtureId);
    if (rubber.teamSlug) {
      const team = entry.byTeam.get(rubber.teamSlug) ?? {
        name: rubber.teamName,
        division: rubber.division,
        count: 0,
      };
      team.count += 1;
      entry.byTeam.set(rubber.teamSlug, team);
    }
  }

  const rows: AverageRow[] = [];
  for (const entry of players.values()) {
    const record = recordOf(entry.matches);
    // Listed for singles, as the league lists them. A player who has only
    // played doubles has no average to place, and their own page has the
    // match.
    if (record.played === 0) continue;

    /*
     * A player who turned out for two teams is placed with the one they
     * played most for, not the first card that happened to name them.
     * That is what the league does with someone who plays up: they
     * appear in their own division's table.
     *
     * And the slug moves with the name: a player labelled with their main
     * team and linked to the other is a wrong link that looks completely
     * right on the page.
     */
    const [mainSlug, main] =
      [...entry.byTeam.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? [];
    const teamName = main?.name ?? entry.first.teamName;
    const teamSlug = mainSlug ?? entry.first.teamSlug;
    const division = main?.division ?? entry.first.division;
    const matchesPlayed = entry.fixtures.size;

    // Measured against their own team's programme: playing every match
    // of a twelve-match Division One season is not less committed than
    // playing every match of a fourteen-match Premier one.
    const teamPlayed = mainSlug ? (teamMatches[mainSlug] ?? 0) : 0;
    const meets = teamPlayed === 0 ? true : matchesPlayed * 2 >= teamPlayed;

    rows.push({
      memberId: entry.memberId,
      memberName: entry.memberName,
      memberSlug: entry.memberSlug,
      teamName,
      teamSlug,
      division,
      matchesPlayed,
      ...record,
      meetsParticipationThreshold: meets,
    });
  }

  return rows.sort(compareAverages);
}

/** What the league's ordering reads — shared by the server's rows and the page's. */
export type AverageOrder = Pick<AverageRow, "winPercentage" | "played" | "memberName">;

/**
 * The league's own ordering — "averages sequence".
 *
 * Percentage first, then the number played, so a player who won eight of
 * eight is above one who won six of six, and both are above someone on
 * 94%. Name last, only so the order is stable between requests rather
 * than shuffling on every load.
 */
export function compareAverages(a: AverageOrder, b: AverageOrder): number {
  const byPercent = (b.winPercentage ?? -1) - (a.winPercentage ?? -1);
  if (byPercent !== 0) return byPercent;
  if (b.played !== a.played) return b.played - a.played;
  return a.memberName.localeCompare(b.memberName);
}
