import type { PlayerRubber, PlayerSeasonStat, PlayerStatistics } from "@shared/types.js";

/**
 * A small made-up career for the statistics tests: two seasons of
 * averages and three match nights of cards — home and away, a doubles,
 * a deuce game, a five-game decider and a comeback from a game down.
 */

let seq = 0;
export function rubber(overrides: Partial<PlayerRubber> = {}): PlayerRubber {
  seq += 1;
  const games = overrides.games ?? [
    [11, 5],
    [11, 7],
    [11, 9],
  ];
  const setsFor = games.filter(([a, b]) => a > b).length;
  const setsAgainst = games.length - setsFor;
  return {
    fixtureId: "f1",
    playedOn: "2026-09-23",
    seasonLabel: "2026-27",
    team: { name: "HRC A", slug: "hrc-a", division: "premier" },
    opponentTeam: { name: "Kidston", slug: "kidston", division: "premier" },
    isHome: true,
    rubberNumber: seq,
    kind: "singles",
    partner: null,
    opponents: [{ name: "Reuben Okai", slug: "reuben-okai" }],
    setsFor,
    setsAgainst,
    won: setsFor > setsAgainst,
    games,
    ...overrides,
  };
}

function season(overrides: Partial<PlayerSeasonStat>): PlayerSeasonStat {
  return {
    seasonLabel: "2026-27",
    teamName: "HRC A",
    teamSlug: "hrc-a",
    division: "premier",
    played: 9,
    won: 7,
    lost: 2,
    winPercentage: 78,
    doublesPlayed: 3,
    doublesWon: 2,
    setsFor: 23,
    setsAgainst: 10,
    matchesPlayed: 3,
    teamMatchesPlayed: 4,
    meetsParticipationThreshold: true,
    place: 2,
    tied: false,
    placedOf: 18,
    divisionMedian: 50,
    handicap: null,
    ...overrides,
  };
}

const night = (fixtureId: string, playedOn: string, isHome: boolean, team: string) => ({
  fixtureId,
  playedOn,
  isHome,
  opponentTeam: { name: team, slug: team.toLowerCase().replace(/\s+/g, "-"), division: "premier" as const },
});

export const RUBBERS: PlayerRubber[] = [
  // Night one, at home to Kidston: three wins, one at deuce.
  rubber({ ...night("f1", "2026-09-23", true, "Kidston"), rubberNumber: 1, games: [[11, 5], [11, 4], [13, 11]] }),
  rubber({ ...night("f1", "2026-09-23", true, "Kidston"), rubberNumber: 5, opponents: [{ name: "Simon Parker", slug: "simon-parker" }], games: [[8, 11], [11, 3], [12, 10], [11, 5]] }),
  rubber({ ...night("f1", "2026-09-23", true, "Kidston"), rubberNumber: 9, opponents: [{ name: "Daniel Walters", slug: "daniel-walters" }] }),
  rubber({ ...night("f1", "2026-09-23", true, "Kidston"), rubberNumber: 10, kind: "doubles", partner: { name: "Chris Wade", slug: "chris-wade" }, opponents: [{ name: "Reuben Okai", slug: "reuben-okai" }, { name: "Simon Parker", slug: "simon-parker" }], games: [[14, 12], [15, 13], [6, 11], [6, 11], [7, 11]] }),
  // Night two, away at Water Lane A: one lost in five, one won, one lost.
  rubber({ ...night("f2", "2026-10-07", false, "Water Lane A"), rubberNumber: 2, opponents: [{ name: "Shaun Gardner", slug: "shaun-gardner" }], games: [[11, 9], [9, 11], [11, 8], [7, 11], [9, 11]] }),
  rubber({ ...night("f2", "2026-10-07", false, "Water Lane A"), rubberNumber: 4, opponents: [{ name: "Elliott Lugg", slug: "elliott-lugg" }] }),
  rubber({ ...night("f2", "2026-10-07", false, "Water Lane A"), rubberNumber: 7, opponents: [{ name: "A Visitor", slug: null }], games: [[4, 11], [5, 11], [9, 11]] }),
  rubber({ ...night("f2", "2026-10-07", false, "Water Lane A"), rubberNumber: 10, kind: "doubles", partner: { name: "Sandy Nash", slug: "sandy-nash" }, opponents: [{ name: "Shaun Gardner", slug: "shaun-gardner" }, { name: "Elliott Lugg", slug: "elliott-lugg" }] }),
  // Night three, at home to Kidston again: Reuben Okai a second time.
  rubber({ ...night("f3", "2026-11-04", true, "Kidston"), rubberNumber: 1 }),
  rubber({ ...night("f3", "2026-11-04", true, "Kidston"), rubberNumber: 5, opponents: [{ name: "Simon Parker", slug: "simon-parker" }] }),
  rubber({ ...night("f3", "2026-11-04", true, "Kidston"), rubberNumber: 9, opponents: [{ name: "Daniel Walters", slug: "daniel-walters" }] }),
  rubber({ ...night("f3", "2026-11-04", true, "Kidston"), rubberNumber: 10, kind: "doubles", partner: { name: "Chris Wade", slug: "chris-wade" } }),
];

export const STATISTICS: PlayerStatistics = {
  fullName: "Derek Balding",
  displayName: null,
  slug: "derek-balding",
  rubbers: RUBBERS,
  seasons: [
    season({ seasonLabel: "2025-26", played: 24, won: 22, lost: 2, winPercentage: 92, doublesPlayed: null, doublesWon: null, setsFor: null, setsAgainst: null, matchesPlayed: null, teamMatchesPlayed: null, place: 1, placedOf: 22, divisionMedian: 49 }),
    season({}),
  ],
  peers: {
    seasonLabel: "2026-27",
    division: "premier",
    teamSlug: "hrc-a",
    players: [
      { memberName: "Derek Balding", memberSlug: "derek-balding", teamName: "HRC A", teamSlug: "hrc-a", played: 9, winPercentage: 78, meetsParticipationThreshold: true },
      { memberName: "Chris Wade", memberSlug: "chris-wade", teamName: "HRC A", teamSlug: "hrc-a", played: 6, winPercentage: 50, meetsParticipationThreshold: true },
      { memberName: "Reuben Okai", memberSlug: "reuben-okai", teamName: "Kidston", teamSlug: "kidston", played: 9, winPercentage: 89, meetsParticipationThreshold: true },
      { memberName: "Simon Parker", memberSlug: "simon-parker", teamName: "Kidston", teamSlug: "kidston", played: 9, winPercentage: 33, meetsParticipationThreshold: true },
    ],
  },
  opponentRates: {
    "2026-27|reuben-okai": 89,
    "2026-27|simon-parker": 33,
    "2026-27|daniel-walters": 56,
    "2026-27|shaun-gardner": 90,
    "2026-27|elliott-lugg": 88,
  },
};
