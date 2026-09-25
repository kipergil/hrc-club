import type { Division } from "@shared/enums.js";
import type { PlayerStat } from "@shared/types.js";
import { compareAverages } from "@shared/averages.js";

/**
 * What the averages page does to the rows it is given: place them, filter
 * them, sort them. Kept out of the component so each rule has a test and
 * none of them hides inside a render.
 */

export const SORT_KEYS = [
  "place",
  "name",
  "team",
  "matches",
  "played",
  "won",
  "lost",
  "percent",
  "doubles",
  "sets",
] as const;
export type SortKey = (typeof SORT_KEYS)[number];
export type SortDir = "asc" | "desc";

export function isSortKey(value: string | undefined): value is SortKey {
  return (SORT_KEYS as readonly string[]).includes(value ?? "");
}

/**
 * Which way a column sorts on its first click.
 *
 * Names A to Z and placings 1 upwards, because that is how anybody reads
 * them; every count biggest first, because "who has won most" is the
 * question somebody clicking Won is asking.
 */
export function firstDirection(key: SortKey): SortDir {
  return key === "place" || key === "name" || key === "team" ? "asc" : "desc";
}

export interface PlacedStat extends PlayerStat {
  /** Their placing in their division; null until they meet the 50% rule. */
  place: number | null;
  /** Level with the player above or below — printed as "=3". */
  tied: boolean;
}

/** The filter value for a player's team. */
export function teamKey(stat: Pick<PlayerStat, "teamSlug" | "teamName">): string | null {
  return stat.teamSlug ?? stat.teamName;
}

/**
 * The league's placings, division by division.
 *
 * Worked out on every player of the division before any filter is
 * applied: narrowing the page to one team must not make that team's best
 * player "1st" — their placing is where they stand in the division, which
 * is the number the league prints.
 *
 * Only eligible players are placed. Level players — the same percentage
 * from the same number played — share a placing, and the next one skips,
 * as a league table does.
 */
export function withPlaces(stats: PlayerStat[]): PlacedStat[] {
  const placed = new Map<string, { place: number; tied: boolean }>();
  const divisions = new Map<Division | null, PlayerStat[]>();
  for (const stat of stats) {
    const list = divisions.get(stat.division) ?? [];
    list.push(stat);
    divisions.set(stat.division, list);
  }

  for (const list of divisions.values()) {
    const eligible = list.filter((stat) => stat.meetsParticipationThreshold).sort(compareAverages);
    const level = (a: PlayerStat | undefined, b: PlayerStat | undefined) =>
      Boolean(a && b) && a!.winPercentage === b!.winPercentage && a!.played === b!.played;

    eligible.forEach((stat, index) => {
      const previous = eligible[index - 1];
      const place = level(previous, stat) ? placed.get(previous!.id)!.place : index + 1;
      placed.set(stat.id, { place, tied: level(previous, stat) || level(stat, eligible[index + 1]) });
    });
  }

  return stats.map((stat) => ({
    ...stat,
    place: placed.get(stat.id)?.place ?? null,
    tied: placed.get(stat.id)?.tied ?? false,
  }));
}

export function filterStats<T extends PlayerStat>(
  stats: T[],
  { division, team }: { division?: Division | "all"; team?: string },
): T[] {
  return stats.filter(
    (stat) =>
      (!division || division === "all" || stat.division === division) &&
      (!team || teamKey(stat) === team),
  );
}

/** Every team with a player in the averages, in the order the page lists them. */
export function teamOptions(
  stats: PlayerStat[],
  division: Division | "all" = "all",
): Array<{ value: string; label: string; division: Division | null }> {
  const seen = new Map<string, { value: string; label: string; division: Division | null }>();
  for (const stat of filterStats(stats, { division })) {
    const key = teamKey(stat);
    if (!key || seen.has(key)) continue;
    seen.set(key, { value: key, label: stat.teamName ?? key, division: stat.division });
  }
  return [...seen.values()].sort((a, b) => a.label.localeCompare(b.label));
}

/**
 * A column's value for sorting. Null where the season has no such figure
 * — an archived season printed only Played, Won, Lost and % — and a null
 * always sorts last, whichever way the column runs, so reversing a column
 * never floats a row of dashes to the top.
 */
function valueOf(stat: PlacedStat, key: SortKey): number | string | null {
  switch (key) {
    case "place":
      return stat.place;
    case "name":
      return stat.memberName;
    case "team":
      return stat.teamName;
    case "matches":
      return stat.matchesPlayed;
    case "played":
      return stat.played;
    case "won":
      return stat.won;
    case "lost":
      return stat.lost;
    case "percent":
      return stat.winPercentage;
    case "doubles":
      // Won first, then played: two doubles won out of two beats one of one.
      return stat.doublesWon === null || stat.doublesPlayed === null
        ? null
        : stat.doublesWon * 1000 + stat.doublesPlayed;
    case "sets":
      // The difference, as a league table sorts it, then the number won.
      return stat.setsFor === null || stat.setsAgainst === null
        ? null
        : (stat.setsFor - stat.setsAgainst) * 1000 + stat.setsFor;
  }
}

export function sortStats(stats: PlacedStat[], key: SortKey, dir: SortDir): PlacedStat[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...stats].sort((a, b) => {
    const left = valueOf(a, key);
    const right = valueOf(b, key);
    if (left !== right) {
      if (left === null) return 1;
      if (right === null) return -1;
      const order =
        typeof left === "string" && typeof right === "string"
          ? left.localeCompare(right)
          : Number(left) - Number(right);
      if (order !== 0) return order * sign;
    }
    // Level on the column: the league's own order decides, so a tie never
    // shuffles between one load and the next.
    return compareAverages(a, b);
  });
}
