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

/** One singles rubber, as the averages care about it. */
export interface AverageSource {
  memberId: string;
  memberName: string;
  memberSlug: string;
  /** The doubles is excluded; passing it in is how a caller opts out. */
  kind: "singles" | "doubles";
  won: boolean;
  /** Distinct fixtures are what "matches played" counts. */
  fixtureId: string;
  teamName: string | null;
  teamSlug: string | null;
  division: Division | null;
}

export interface AverageRow {
  memberId: string;
  memberName: string;
  memberSlug: string;
  teamName: string | null;
  division: Division | null;
  played: number;
  won: number;
  lost: number;
  /** Whole percent, as the league prints it. Null when nothing was played. */
  winPercentage: number | null;
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
    row: Omit<AverageRow, "winPercentage" | "matchesPlayed" | "meetsParticipationThreshold">;
    fixtures: Set<string>;
    /** Rubbers played for each team, so the main team is the one they played most for. */
    byTeam: Map<string, { name: string | null; division: Division | null; count: number }>;
  }

  const players = new Map<string, Accumulator>();

  for (const rubber of rubbers) {
    // Singles only. The doubles is a pair's result, not a player's, and
    // the league has never counted it here.
    if (rubber.kind !== "singles") continue;
    if (!rubber.memberId) continue;

    let entry = players.get(rubber.memberId);
    if (!entry) {
      entry = {
        row: {
          memberId: rubber.memberId,
          memberName: rubber.memberName,
          memberSlug: rubber.memberSlug,
          teamName: rubber.teamName,
          division: rubber.division,
          played: 0,
          won: 0,
          lost: 0,
        },
        fixtures: new Set(),
        byTeam: new Map(),
      };
      players.set(rubber.memberId, entry);
    }

    entry.row.played += 1;
    if (rubber.won) entry.row.won += 1;
    else entry.row.lost += 1;
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
    /*
     * A player who turned out for two teams is placed with the one they
     * played most for, not the first card that happened to name them.
     * That is what the league does with someone who plays up: they
     * appear in their own division's table.
     */
    const [mainSlug, main] =
      [...entry.byTeam.entries()].sort((a, b) => b[1].count - a[1].count)[0] ?? [];

    const teamName = main?.name ?? entry.row.teamName;
    const division = main?.division ?? entry.row.division;
    const matchesPlayed = entry.fixtures.size;

    // Measured against their own team's programme: playing every match
    // of a twelve-match Division One season is not less committed than
    // playing every match of a fourteen-match Premier one.
    const teamPlayed = mainSlug ? (teamMatches[mainSlug] ?? 0) : 0;
    const meets = teamPlayed === 0 ? true : matchesPlayed * 2 >= teamPlayed;

    rows.push({
      ...entry.row,
      teamName,
      division,
      matchesPlayed,
      winPercentage:
        entry.row.played === 0 ? null : Math.round((entry.row.won / entry.row.played) * 100),
      meetsParticipationThreshold: meets,
    });
  }

  return rows.sort(compareAverages);
}

/**
 * The league's own ordering — "averages sequence".
 *
 * Percentage first, then the number played, so a player who won eight of
 * eight is above one who won six of six, and both are above someone on
 * 94%. Name last, only so the order is stable between requests rather
 * than shuffling on every load.
 */
export function compareAverages(a: AverageRow, b: AverageRow): number {
  const byPercent = (b.winPercentage ?? -1) - (a.winPercentage ?? -1);
  if (byPercent !== 0) return byPercent;
  if (b.played !== a.played) return b.played - a.played;
  return a.memberName.localeCompare(b.memberName);
}
