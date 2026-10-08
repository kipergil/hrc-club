import type { MemberProfile, PlayerStatistics } from "@shared/types.js";

/**
 * The charts a player's statistics page can draw, and when each can.
 *
 * Metadata only — no data crunching and no drawing — because the player
 * page imports this to offer the picker, and the player page must stay
 * light. The charts themselves live in a chunk that is only downloaded
 * when somebody opens the statistics page.
 *
 * What is here was chosen from what the site actually holds:
 *
 *  - **Season figures** — played, won, lost, placing — for every season
 *    with averages, whether worked out from cards or imported as the
 *    league printed them.
 *  - **Every game of every match** from the cards, from 2026-27 on. The
 *    league clears its old cards each season, so nothing finer than a
 *    season's totals exists before that.
 *  - **The division's averages**, for where a player sits among everyone
 *    else.
 *
 * A chart the data cannot support is not offered as if it could be: each
 * one says what it needs, and `availability` says whether this player has
 * it yet.
 */

export const CHART_GROUPS = [
  { id: "seasons", title: "Across the seasons", blurb: "How the years compare." },
  { id: "division", title: "In the division", blurb: "Where they stand among everybody else." },
  { id: "matches", title: "Match by match", blurb: "From the cards: every match, game and point." },
] as const;
export type ChartGroup = (typeof CHART_GROUPS)[number]["id"];

/**
 * What the data holds, reduced to the counts the rules below need.
 *
 * Small on purpose: the player page can work it out from the profile it
 * already has, and the statistics page from the full career, and both
 * then run the same rules — so a chart offered on one is drawn on the
 * other.
 */
export interface Evidence {
  /** Seasons with a record of any kind. */
  seasons: number;
  /** Seasons that carry a placing in the division. */
  placedSeasons: number;
  /** Seasons that know how many matches the team played — card seasons. */
  seasonsWithAvailability: number;
  /** Is there a division to compare with? */
  hasPeers: boolean;
  /** Team-mates with averages in the same season. */
  teamMates: number;
  singles: number;
  doubles: number;
  homeSingles: number;
  awaySingles: number;
  /** Distinct matches on the cards. */
  matches: number;
  /** Singles against an opponent whose own win rate is known. */
  ratedOpponents: number;
}

export interface ChartSpec {
  id: string;
  group: ChartGroup;
  title: string;
  /** The question the chart answers, in the reader's words. */
  question: string;
  /** Null when this player has what the chart needs, else what is missing. */
  needs: (evidence: Evidence) => string | null;
  /** On by default in the picker — a short first look, not everything. */
  recommended?: boolean;
}

const twoSeasons = (e: Evidence) =>
  e.seasons >= 2 ? null : "needs two seasons on record";
const someSingles = (n: number) => (e: Evidence) =>
  e.singles >= n ? null : n === 1 ? "needs a singles on a card" : `needs ${WORDS[n] ?? n} singles on the cards`;
const WORDS: Record<number, string> = { 3: "three", 6: "six" };

export const STAT_CHARTS: readonly ChartSpec[] = [
  // -- Across the seasons -------------------------------------------------
  {
    id: "season-rate",
    group: "seasons",
    title: "Win rate each season",
    question: "Are they getting better, and how do they compare with the division?",
    needs: twoSeasons,
    recommended: true,
  },
  {
    id: "season-record",
    group: "seasons",
    title: "Singles won and lost each season",
    question: "How much do they play, and how many do they drop?",
    needs: twoSeasons,
  },
  {
    id: "season-placing",
    group: "seasons",
    title: "Placing in the averages",
    question: "Where did they finish in their division each year?",
    needs: (e) =>
      e.seasons < 2 ? "needs two seasons on record" : e.placedSeasons === 0 ? "needs a season with a placing" : null,
  },
  {
    id: "availability",
    group: "seasons",
    title: "Matches played of the team's",
    question: "How often do they turn out, against the 50% the league needs?",
    needs: (e) => (e.seasonsWithAvailability > 0 ? null : "needs a season with match cards"),
  },
  {
    id: "career",
    group: "seasons",
    title: "Career singles, added up",
    question: "The running total of every singles won and lost.",
    needs: twoSeasons,
  },

  // -- In the division ----------------------------------------------------
  {
    id: "division",
    group: "division",
    title: "Where they sit in the division",
    question: "Every eligible player's win rate, with this one picked out.",
    needs: (e) => (e.hasPeers ? null : "needs a season with averages"),
    recommended: true,
  },
  {
    id: "team-mates",
    group: "division",
    title: "Against their team-mates",
    question: "Played most, and won most of it? Up and to the right is best.",
    needs: (e) => (e.teamMates >= 1 ? null : "needs team-mates with averages"),
  },

  // -- Match by match -----------------------------------------------------
  {
    id: "form",
    group: "matches",
    title: "Singles won and lost, each match",
    question: "How each match night went.",
    needs: someSingles(1),
    recommended: true,
  },
  {
    id: "running-rate",
    group: "matches",
    title: "Win rate through the season",
    question: "The averages figure, after every match.",
    needs: (e) => (e.matches >= 2 ? null : "needs two matches on the cards"),
    recommended: true,
  },
  {
    id: "recent-form",
    group: "matches",
    title: "Recent form: last six singles",
    question: "On a run, or in a dip?",
    needs: someSingles(6),
  },
  {
    id: "games",
    group: "matches",
    title: "Games won and lost, singles by singles",
    question: "Comfortable wins, or scraped through?",
    needs: someSingles(1),
  },
  {
    id: "margins",
    group: "matches",
    title: "How close the games are",
    question: "Every game by its points margin.",
    needs: someSingles(1),
  },
  {
    id: "pressure",
    group: "matches",
    title: "Under pressure",
    question: "Deuce games, deciding fifth games, and coming back from a game down.",
    needs: someSingles(3),
  },
  {
    id: "opponents",
    group: "matches",
    title: "Results by opponent strength",
    question: "Who do they beat, and how do they do against the best?",
    needs: (e) => (e.ratedOpponents >= 1 ? null : "needs opponents with averages"),
  },
  {
    id: "home-away",
    group: "matches",
    title: "Home and away",
    question: "Does the venue make a difference?",
    needs: (e) =>
      e.homeSingles > 0 && e.awaySingles > 0 ? null : "needs singles both home and away",
  },
  {
    id: "doubles",
    group: "matches",
    title: "Doubles, by partner",
    question: "Which pairing works?",
    needs: (e) => (e.doubles > 0 ? null : "needs a doubles on a card"),
  },
  {
    id: "points-share",
    group: "matches",
    title: "Share of points won, each match",
    question: "Beyond wins and losses: how dominant was each night?",
    needs: someSingles(1),
  },
  {
    id: "head-to-head",
    group: "matches",
    title: "Head to head",
    question: "Who they meet most, and how it went.",
    needs: someSingles(1),
    recommended: true,
  },
];

const BY_ID = new Map(STAT_CHARTS.map((chart) => [chart.id, chart]));

export function chartById(id: string): ChartSpec | undefined {
  return BY_ID.get(id);
}

/** The charts named in a `?charts=` value, in catalogue order, unknown names dropped. */
export function parseChartIds(value: string | undefined): string[] {
  if (!value) return [];
  const wanted = new Set(value.split(",").map((id) => id.trim()));
  return STAT_CHARTS.filter((chart) => wanted.has(chart.id)).map((chart) => chart.id);
}

export function availableIds(evidence: Evidence): string[] {
  return STAT_CHARTS.filter((chart) => chart.needs(evidence) === null).map((chart) => chart.id);
}

/** The first look: the recommended charts this player can show. */
export function defaultChartIds(evidence: Evidence): string[] {
  const available = new Set(availableIds(evidence));
  const picked = STAT_CHARTS.filter((chart) => chart.recommended && available.has(chart.id));
  return picked.map((chart) => chart.id);
}

export function statsHref(slug: string, ids: string[]): string {
  return ids.length === 0 ? `/players/${slug}/stats` : `/players/${slug}/stats?charts=${ids.join(",")}`;
}

// ---------------------------------------------------------------------------
// Evidence, from either page's data
// ---------------------------------------------------------------------------

function cardEvidence(rubbers: MemberProfile["rubbers"]) {
  const singles = rubbers.filter((rubber) => rubber.kind === "singles");
  return {
    singles: singles.length,
    doubles: rubbers.length - singles.length,
    homeSingles: singles.filter((rubber) => rubber.isHome).length,
    awaySingles: singles.filter((rubber) => !rubber.isHome).length,
    matches: new Set(rubbers.map((rubber) => rubber.fixtureId)).size,
  };
}

/**
 * From the player page's profile, which holds one season's cards and the
 * archived seasons' averages. An estimate on the generous side for the
 * division charts — the profile does not carry the division — which the
 * statistics page then settles from the full data.
 */
export function evidenceFromProfile(player: MemberProfile): Evidence {
  const seasons = new Set<string>();
  for (const stat of player.stats) seasons.add(stat.seasonLabel);
  for (const rubber of player.rubbers) if (rubber.seasonLabel) seasons.add(rubber.seasonLabel);
  const cards = cardEvidence(player.rubbers);
  const hasRecord = player.stats.length > 0 || cards.singles > 0;
  return {
    seasons: seasons.size,
    placedSeasons: player.stats.some((stat) => stat.meetsParticipationThreshold) || cards.singles > 0 ? 1 : 0,
    seasonsWithAvailability: cards.matches > 0 ? 1 : 0,
    hasPeers: hasRecord,
    teamMates: hasRecord ? 1 : 0,
    ...cards,
    ratedOpponents: player.rubbers.some((rubber) => rubber.kind === "singles" && rubber.opponents[0]?.slug)
      ? 1
      : 0,
  };
}

/** From the statistics page's full data: the definitive answer. */
export function evidenceFromStatistics(data: PlayerStatistics): Evidence {
  const cards = cardEvidence(data.rubbers);
  const latestTeam = data.peers?.teamSlug;
  return {
    seasons: data.seasons.length,
    placedSeasons: data.seasons.filter((season) => season.place !== null).length,
    seasonsWithAvailability: data.seasons.filter(
      (season) => season.matchesPlayed !== null && season.teamMatchesPlayed !== null,
    ).length,
    hasPeers: Boolean(data.peers && data.peers.players.some((peer) => peer.meetsParticipationThreshold)),
    teamMates: latestTeam
      ? (data.peers?.players.filter((peer) => peer.teamSlug === latestTeam && peer.memberSlug !== data.slug)
          .length ?? 0)
      : 0,
    ...cards,
    ratedOpponents: data.rubbers.filter(
      (rubber) =>
        rubber.kind === "singles" &&
        rubber.opponents[0]?.slug &&
        data.opponentRates[`${rubber.seasonLabel}|${rubber.opponents[0].slug}`] !== undefined,
    ).length,
  };
}
