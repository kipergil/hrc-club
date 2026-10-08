import { describe, expect, it } from "vitest";
import type { MemberProfile } from "@shared/types.js";
import {
  STAT_CHARTS,
  availableIds,
  evidenceFromProfile,
  evidenceFromStatistics,
  statsHref,
  type Evidence,
} from "./stat-charts";
import { STATISTICS, rubber } from "./player-stats.fixture";

const nothing: Evidence = {
  seasons: 0,
  placedSeasons: 0,
  seasonsWithAvailability: 0,
  hasPeers: false,
  teamMates: 0,
  singles: 0,
  doubles: 0,
  homeSingles: 0,
  awaySingles: 0,
  matches: 0,
  ratedOpponents: 0,
};

describe("the chart catalogue", () => {
  it("has a distinct id for every chart", () => {
    const ids = STAT_CHARTS.map((chart) => chart.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("offers nothing to a player with nothing on record", () => {
    expect(availableIds(nothing)).toEqual([]);
    expect(STAT_CHARTS.every((chart) => typeof chart.needs(nothing) === "string")).toBe(true);
  });

  it("does not offer a comparison of seasons from one season", () => {
    const one = { ...nothing, seasons: 1, singles: 3, matches: 1, homeSingles: 3 };
    const ids = availableIds(one);
    expect(ids).toContain("form");
    expect(ids).not.toContain("season-rate");
    expect(ids).not.toContain("running-rate"); // a line through one point
    expect(ids).not.toContain("home-away"); // nothing away to compare
  });

  it("offers everything for a full career", () => {
    expect(availableIds(evidenceFromStatistics(STATISTICS))).toEqual(STAT_CHARTS.map((chart) => chart.id));
  });

  it("explains every chart, for the info button beside it", () => {
    for (const chart of STAT_CHARTS) {
      expect(chart.about.length, chart.id).toBeGreaterThan(40);
      expect(chart.about.length, chart.id).toBeLessThan(420);
    }
  });
});

describe("the address", () => {
  it("is the player's own statistics page, with no choice to carry", () => {
    expect(statsHref("derek-balding")).toBe("/players/derek-balding/stats");
  });
});

describe("evidence from a profile", () => {
  it("counts what the player page already holds, without fetching", () => {
    const profile = {
      stats: [],
      rubbers: [rubber(), rubber({ isHome: false, fixtureId: "f2" }), rubber({ kind: "doubles" })],
    } as unknown as MemberProfile;
    const evidence = evidenceFromProfile(profile);
    expect(evidence).toMatchObject({ seasons: 1, singles: 2, doubles: 1, homeSingles: 1, awaySingles: 1, matches: 2 });
    expect(availableIds(evidence)).toContain("home-away");
  });
});
