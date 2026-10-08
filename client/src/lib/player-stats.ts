import type { PeerStat, PlayerRubber, PlayerSeasonStat, PlayerStatistics } from "@shared/types.js";

/**
 * The arithmetic behind each chart on a player's statistics page.
 *
 * Pure functions from the API's data to the numbers a chart draws, so
 * every figure on the page has a test and none of it hides in a render.
 * Imported only by the statistics page, which is loaded on demand.
 */

const pct = (part: number, whole: number): number | null =>
  whole === 0 ? null : Math.round((part / whole) * 100);

/** Seasons that have cards, newest first — the choices for the match-by-match charts. */
export function cardSeasons(rubbers: PlayerRubber[]): string[] {
  const seen = new Set<string>();
  for (const rubber of rubbers) if (rubber.seasonLabel) seen.add(rubber.seasonLabel);
  return [...seen].sort().reverse();
}

// ---------------------------------------------------------------------------
// Matches
// ---------------------------------------------------------------------------

export interface MatchNight {
  fixtureId: string;
  playedOn: string | null;
  seasonLabel: string | null;
  opponentTeam: string;
  isHome: boolean;
  singles: PlayerRubber[];
  doubles: PlayerRubber | null;
}

/** The cards grouped into match nights, oldest first. */
export function matchNights(rubbers: PlayerRubber[]): MatchNight[] {
  const nights = new Map<string, MatchNight>();
  for (const rubber of rubbers) {
    let night = nights.get(rubber.fixtureId);
    if (!night) {
      night = {
        fixtureId: rubber.fixtureId,
        playedOn: rubber.playedOn,
        seasonLabel: rubber.seasonLabel,
        opponentTeam: rubber.opponentTeam.name,
        isHome: rubber.isHome,
        singles: [],
        doubles: null,
      };
      nights.set(rubber.fixtureId, night);
    }
    if (rubber.kind === "doubles") night.doubles = rubber;
    else night.singles.push(rubber);
  }
  for (const night of nights.values()) night.singles.sort((a, b) => a.rubberNumber - b.rubberNumber);
  return [...nights.values()].sort((a, b) => (a.playedOn ?? "").localeCompare(b.playedOn ?? ""));
}

/** "v Kidston" at home, "at Kidston" away — the way a fixture list reads. */
export function nightLabel(night: Pick<MatchNight, "isHome" | "opponentTeam">): string {
  return `${night.isHome ? "v" : "at"} ${night.opponentTeam}`;
}

export function singlesOf(rubbers: PlayerRubber[]): PlayerRubber[] {
  return rubbers
    .filter((rubber) => rubber.kind === "singles")
    .sort((a, b) => {
      const byDate = (a.playedOn ?? "").localeCompare(b.playedOn ?? "");
      return byDate !== 0 ? byDate : a.rubberNumber - b.rubberNumber;
    });
}

export function opponentName(rubber: PlayerRubber): string {
  return rubber.opponents.map((opponent) => opponent.name).join(" & ") || "Unknown";
}

export interface NightForm {
  label: string;
  won: number;
  lost: number;
}

export function formByNight(nights: MatchNight[]): NightForm[] {
  return nights
    .filter((night) => night.singles.length > 0)
    .map((night) => {
      const won = night.singles.filter((rubber) => rubber.won).length;
      return { label: nightLabel(night), won, lost: night.singles.length - won };
    });
}

/** The season's singles win rate after each match night — the averages figure, as it moved. */
export function runningRate(nights: MatchNight[]): Array<{ label: string; rate: number }> {
  let won = 0;
  let played = 0;
  const out: Array<{ label: string; rate: number }> = [];
  for (const night of nights) {
    if (night.singles.length === 0) continue;
    played += night.singles.length;
    won += night.singles.filter((rubber) => rubber.won).length;
    out.push({ label: nightLabel(night), rate: pct(won, played)! });
  }
  return out;
}

/** Win rate over the last `window` singles, after each singles. */
export function rollingForm(singles: PlayerRubber[], window = 6): Array<{ index: number; rate: number; won: boolean; opponent: string }> {
  return singles.map((rubber, index) => {
    const slice = singles.slice(Math.max(0, index - window + 1), index + 1);
    return {
      index: index + 1,
      rate: pct(slice.filter((one) => one.won).length, slice.length)!,
      won: rubber.won,
      opponent: opponentName(rubber),
    };
  });
}

export interface Game {
  for: number;
  against: number;
  won: boolean;
  /** 1-based game number within its match. */
  number: number;
  /** How many games that match went to. */
  of: number;
}

export function gamesOf(singles: PlayerRubber[]): Game[] {
  return singles.flatMap((rubber) =>
    rubber.games.map(([own, other], index) => ({
      for: own,
      against: other,
      won: own > other,
      number: index + 1,
      of: rubber.games.length,
    })),
  );
}

/**
 * How many games were won or lost by each points margin.
 *
 * Signed: +3 is a game won 11–8, −2 a game lost at deuce. A game cannot
 * be decided by fewer than two points, so there is no bar at ±1 or 0.
 */
export function marginCounts(games: Game[]): Array<{ margin: number; count: number }> {
  if (games.length === 0) return [];
  const margins = games.map((game) => game.for - game.against);
  const low = Math.min(-2, ...margins);
  const high = Math.max(2, ...margins);
  const out: Array<{ margin: number; count: number }> = [];
  for (let margin = low; margin <= high; margin += 1) {
    if (Math.abs(margin) < 2) continue;
    out.push({ margin, count: margins.filter((value) => value === margin).length });
  }
  return out;
}

export interface WonLost {
  label: string;
  won: number;
  lost: number;
}

/** The tight moments, each counted won and lost. */
export function pressure(singles: PlayerRubber[]): WonLost[] {
  const games = gamesOf(singles);
  const deuce = games.filter((game) => Math.max(game.for, game.against) > 11);
  const deciders = games.filter((game) => game.number === 5);
  const behind = singles.filter((rubber) => {
    const first = rubber.games[0];
    return first !== undefined && first[0] < first[1];
  });
  return [
    { label: "Deuce games", won: deuce.filter((g) => g.won).length, lost: deuce.filter((g) => !g.won).length },
    { label: "Deciding fifth games", won: deciders.filter((g) => g.won).length, lost: deciders.filter((g) => !g.won).length },
    { label: "After losing game one", won: behind.filter((r) => r.won).length, lost: behind.filter((r) => !r.won).length },
  ];
}

export function rateKey(rubber: PlayerRubber): string | null {
  const slug = rubber.opponents[0]?.slug;
  return slug && rubber.seasonLabel ? `${rubber.seasonLabel}|${slug}` : null;
}

/**
 * Results grouped by how good the opponent is, measured by the opponent's
 * own singles win rate that season.
 */
export function byOpponentStrength(singles: PlayerRubber[], rates: Record<string, number>): WonLost[] {
  const bands: Array<[string, (rate: number | undefined) => boolean]> = [
    ["Opponents under 40%", (rate) => rate !== undefined && rate < 40],
    ["40% to 69%", (rate) => rate !== undefined && rate >= 40 && rate < 70],
    ["70% and over", (rate) => rate !== undefined && rate >= 70],
    ["No average known", (rate) => rate === undefined],
  ];
  return bands
    .map(([label, test]) => {
      const inBand = singles.filter((rubber) => {
        const key = rateKey(rubber);
        return test(key ? rates[key] : undefined);
      });
      return { label, won: inBand.filter((r) => r.won).length, lost: inBand.filter((r) => !r.won).length };
    })
    .filter((band) => band.won + band.lost > 0);
}

export function homeAndAway(singles: PlayerRubber[]): WonLost[] {
  return [true, false].map((home) => {
    const side = singles.filter((rubber) => rubber.isHome === home);
    return {
      label: home ? "At home" : "Away",
      won: side.filter((r) => r.won).length,
      lost: side.filter((r) => !r.won).length,
    };
  });
}

export function doublesByPartner(rubbers: PlayerRubber[]): WonLost[] {
  const partners = new Map<string, WonLost>();
  for (const rubber of rubbers) {
    if (rubber.kind !== "doubles") continue;
    const name = rubber.partner?.name ?? "Partner not recorded";
    const entry = partners.get(name) ?? { label: name, won: 0, lost: 0 };
    if (rubber.won) entry.won += 1;
    else entry.lost += 1;
    partners.set(name, entry);
  }
  return [...partners.values()].sort((a, b) => b.won + b.lost - (a.won + a.lost) || b.won - a.won);
}

/** Share of all points won in the night's singles. */
export function pointsShare(nights: MatchNight[]): Array<{ label: string; share: number; for: number; against: number }> {
  return nights
    .filter((night) => night.singles.length > 0)
    .map((night) => {
      const games = gamesOf(night.singles);
      const won = games.reduce((sum, game) => sum + game.for, 0);
      const lost = games.reduce((sum, game) => sum + game.against, 0);
      return { label: nightLabel(night), share: pct(won, won + lost) ?? 0, for: won, against: lost };
    });
}

export interface HeadToHead {
  opponent: string;
  slug: string | null;
  team: string;
  rate: number | null;
  results: Array<{ setsFor: number; setsAgainst: number; won: boolean; games: Array<[number, number]> }>;
  gamesFor: number;
  gamesAgainst: number;
}

/** Each opponent met in singles: most-met first, then the strongest. */
export function headToHead(singles: PlayerRubber[], rates: Record<string, number>): HeadToHead[] {
  const rows = new Map<string, HeadToHead>();
  for (const rubber of singles) {
    const opponent = rubber.opponents[0];
    const key = opponent?.slug ?? opponentName(rubber);
    let row = rows.get(key);
    if (!row) {
      const rate = rateKey(rubber);
      row = {
        opponent: opponentName(rubber),
        slug: opponent?.slug ?? null,
        team: rubber.opponentTeam.name,
        rate: rate && rates[rate] !== undefined ? rates[rate]! : null,
        results: [],
        gamesFor: 0,
        gamesAgainst: 0,
      };
      rows.set(key, row);
    }
    row.results.push({ setsFor: rubber.setsFor, setsAgainst: rubber.setsAgainst, won: rubber.won, games: rubber.games });
    row.gamesFor += rubber.setsFor;
    row.gamesAgainst += rubber.setsAgainst;
  }
  return [...rows.values()].sort(
    (a, b) => b.results.length - a.results.length || (b.rate ?? -1) - (a.rate ?? -1) || a.opponent.localeCompare(b.opponent),
  );
}

// ---------------------------------------------------------------------------
// Seasons and the division
// ---------------------------------------------------------------------------

export function careerTotals(seasons: PlayerSeasonStat[]): Array<{ season: string; won: number; lost: number }> {
  let won = 0;
  let lost = 0;
  return seasons.map((season) => {
    won += season.won;
    lost += season.lost;
    return { season: season.seasonLabel, won, lost };
  });
}

/** "1st", "=3rd" — a placing as the league prints it. */
export function ordinal(place: number, tied = false): string {
  const tens = place % 100;
  const suffix =
    tens >= 11 && tens <= 13 ? "th" : ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[place % 10] ?? "th";
  return `${tied ? "=" : ""}${place}${suffix}`;
}

/** Eligible players in the division, and how many finished above this one. */
export function divisionSpread(peers: PeerStat[], slug: string) {
  const eligible = peers.filter((peer) => peer.meetsParticipationThreshold && peer.winPercentage !== null);
  const me = peers.find((peer) => peer.memberSlug === slug) ?? null;
  const above = me?.winPercentage == null ? null : eligible.filter((peer) => peer.winPercentage! > me.winPercentage!).length;
  return { eligible, me, above };
}

export function teamMates(peers: PeerStat[], teamSlug: string | null): PeerStat[] {
  return teamSlug ? peers.filter((peer) => peer.teamSlug === teamSlug && peer.winPercentage !== null) : [];
}

/** The player's display name, as the page should call them. */
export function playerName(data: Pick<PlayerStatistics, "displayName" | "fullName">): string {
  return data.displayName ?? data.fullName;
}
