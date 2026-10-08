import type { MemberProfile, PlayerStatistics } from "@shared/types.js";

/**
 * The charts a player's statistics page can draw, and when each can.
 *
 * Metadata only — no data crunching and no drawing — because the player
 * page imports this to decide whether to offer the statistics button, and
 * the player page must stay light. The charts themselves live in a chunk that is only downloaded
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
  /**
   * What the chart is and how to read it, for the info button beside its
   * title. Two or three plain sentences; the question above says why it
   * matters, this says what is drawn.
   */
  about: string;
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
    about:
      "One point per season: the share of singles won. The dashed line is the middle win rate among the division's eligible players that year, so the gap between the lines shows how far above or below the typical player they were. The division is named under each season.",
    needs: twoSeasons,
  },
  {
    id: "season-record",
    group: "seasons",
    title: "Singles won and lost each season",
    question: "How much do they play, and how many do they drop?",
    about:
      "Each column is a season. Singles won rise above the line, singles lost hang below it, so a tall column is a busy season and anything below the line is a defeat. The doubles is not counted, as in the league's averages.",
    needs: twoSeasons,
  },
  {
    id: "season-placing",
    group: "seasons",
    title: "Placing in the averages",
    question: "Where did they finish in their division each year?",
    about:
      "Where the player finished in their division's averages each year, first at the top. Only players who played at least half their team's matches are placed, so a season below that has no point. Placings are within a division: 1st in Division Two is not the same as 1st in the Premier.",
    needs: (e) =>
      e.seasons < 2 ? "needs two seasons on record" : e.placedSeasons === 0 ? "needs a season with a placing" : null,
  },
  {
    id: "availability",
    group: "seasons",
    title: "Matches played of the team's",
    question: "How often do they turn out, against the 50% the league needs?",
    about:
      "How many of the team's matches the player turned out for each season. The dark mark at the middle of each bar is half the team's matches: the league places a player in the averages only once they reach it.",
    needs: (e) => (e.seasonsWithAvailability > 0 ? null : "needs a season with match cards"),
  },
  {
    id: "career",
    group: "seasons",
    title: "Career singles, added up",
    question: "The running total of every singles won and lost.",
    about:
      "Two running totals, season by season: singles won and singles lost since the first season on record. The steeper the won line, the more a season added.",
    needs: twoSeasons,
  },

  // -- In the division ----------------------------------------------------
  {
    id: "division",
    group: "division",
    title: "Where they sit in the division",
    question: "Every eligible player's win rate, with this one picked out.",
    about:
      "Each dot is one eligible player in the division this season, placed by their singles win rate; this player is the red dot. Dots further right won more of their singles.",
    needs: (e) => (e.hasPeers ? null : "needs a season with averages"),
  },
  {
    id: "team-mates",
    group: "division",
    title: "Against their team-mates",
    question: "Played most, and won most of it? Up and to the right is best.",
    about:
      "Each dot is a player in the same team this season. Further right means more singles played, higher means a better win rate, so the top right is the team's most used and most successful player.",
    needs: (e) => (e.teamMates >= 1 ? null : "needs team-mates with averages"),
  },

  // -- Match by match -----------------------------------------------------
  {
    id: "form",
    group: "matches",
    title: "Singles won and lost, each match",
    question: "How each match night went.",
    about:
      "One column per match night. Singles won stand above the line and singles lost hang below it, so a night with nothing below the line was a clean sweep. Hover a column for the opponents and scores.",
    needs: someSingles(1),
  },
  {
    id: "running-rate",
    group: "matches",
    title: "Win rate through the season",
    question: "The averages figure, after every match.",
    about:
      "The player's season win rate after each match: the same figure the averages page shows, as it moved through the season. Early on a single result moves it a lot; later it settles.",
    needs: (e) => (e.matches >= 2 ? null : "needs two matches on the cards"),
  },
  {
    id: "recent-form",
    group: "matches",
    title: "Recent form: last six singles",
    question: "On a run, or in a dip?",
    about:
      "After each singles, the share of the last six that were won. It reacts quickly to a good or bad spell that the season figure smooths over.",
    needs: someSingles(6),
  },
  {
    id: "games",
    group: "matches",
    title: "Games won and lost, singles by singles",
    question: "Comfortable wins, or scraped through?",
    about:
      "One column per singles. Games won stand above the line and games lost hang below it: a 3–0 win is three up and nothing down, a 3–2 win is three up and two down.",
    needs: someSingles(1),
  },
  {
    id: "margins",
    group: "matches",
    title: "How close the games are",
    question: "Every game by its points margin.",
    about:
      "Every singles game, counted by how many points it was won or lost by. Bars to the right are games won, to the left games lost. Tall bars at +2 and −2 mean many close games, deuce included.",
    needs: someSingles(1),
  },
  {
    id: "pressure",
    group: "matches",
    title: "Under pressure",
    question: "Deuce games, deciding fifth games, and coming back from a game down.",
    about:
      "Three kinds of tight moment: games that went to deuce (beyond 11–10), deciding fifth games, and singles where the player lost the first game. Each bar shows how many were won and lost.",
    needs: someSingles(3),
  },
  {
    id: "opponents",
    group: "matches",
    title: "Results by opponent strength",
    question: "Who do they beat, and how do they do against the best?",
    about:
      "Singles grouped by how strong the opponent was, measured by the opponent's own win rate that season. It shows whether results hold up against the league's better players.",
    needs: (e) => (e.ratedOpponents >= 1 ? null : "needs opponents with averages"),
  },
  {
    id: "home-away",
    group: "matches",
    title: "Home and away",
    question: "Does the venue make a difference?",
    about:
      "Singles won and lost at home, and away. Halls differ in light, space and tables, and some players notice it.",
    needs: (e) =>
      e.homeSingles > 0 && e.awaySingles > 0 ? null : "needs singles both home and away",
  },
  {
    id: "doubles",
    group: "matches",
    title: "Doubles, by partner",
    question: "Which pairing works?",
    about:
      "The doubles, grouped by partner. It is not part of the averages, because it is a pair's result, but it is a point for the team.",
    needs: (e) => (e.doubles > 0 ? null : "needs a doubles on a card"),
  },
  {
    id: "points-share",
    group: "matches",
    title: "Share of points won, each match",
    question: "Beyond wins and losses: how dominant was each night?",
    about:
      "Of every point played in the player's singles on a match night, the share they won. Above the dashed 50% line they won more points than they lost; close to it, the night was a fight even if the matches were won.",
    needs: someSingles(1),
  },
  {
    id: "head-to-head",
    group: "matches",
    title: "Head to head",
    question: "Who they meet most, and how it went.",
    about:
      "Every opponent met in singles this season, most-met first, with each result and the games won and lost in total. The win rate beside each name is the opponent's own singles average that season.",
    needs: someSingles(1),
  },
];

const BY_ID = new Map(STAT_CHARTS.map((chart) => [chart.id, chart]));

export function chartById(id: string): ChartSpec | undefined {
  return BY_ID.get(id);
}

export function availableIds(evidence: Evidence): string[] {
  return STAT_CHARTS.filter((chart) => chart.needs(evidence) === null).map((chart) => chart.id);
}

/** A player's statistics page. Every chart they have the data for is on it. */
export function statsHref(slug: string): string {
  return `/players/${slug}/stats`;
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
