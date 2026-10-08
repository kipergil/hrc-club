import { describe, expect, it } from "vitest";
import {
  byOpponentStrength,
  careerTotals,
  divisionRuns,
  divisionShort,
  divisionSpread,
  divisionStory,
  doublesByPartner,
  formByNight,
  gamesOf,
  headToHead,
  homeAndAway,
  marginCounts,
  matchNights,
  ordinal,
  pointsShare,
  pressure,
  rollingForm,
  runningRate,
  singlesOf,
  teamMates,
} from "./player-stats";
import { RUBBERS, STATISTICS, rubber } from "./player-stats.fixture";

const nights = matchNights(RUBBERS);
const singles = singlesOf(RUBBERS);

describe("match nights", () => {
  it("groups the cards into nights, oldest first, with the doubles kept apart", () => {
    expect(nights.map((night) => night.fixtureId)).toEqual(["f1", "f2", "f3"]);
    expect(nights.map((night) => night.singles.length)).toEqual([3, 3, 3]);
    expect(nights.every((night) => night.doubles?.kind === "doubles")).toBe(true);
  });

  it("labels a night the way a fixture list does", () => {
    expect(formByNight(nights).map((row) => row.label)).toEqual(["v Kidston", "at Water Lane A", "v Kidston"]);
  });

  it("counts each night's singles won and lost", () => {
    expect(formByNight(nights).map((row) => [row.won, row.lost])).toEqual([
      [3, 0],
      [1, 2],
      [3, 0],
    ]);
  });

  it("tracks the season figure after every night", () => {
    // 3/3, then 4/6, then 7/9.
    expect(runningRate(nights).map((row) => row.rate)).toEqual([100, 67, 78]);
  });
});

describe("form over the last six", () => {
  it("never looks back further than six singles", () => {
    const rows = rollingForm(singles);
    expect(rows).toHaveLength(9);
    // Singles 4–9: lost two of the six.
    expect(rows[8]!.rate).toBe(67);
    expect(rows[0]!.rate).toBe(100);
  });
});

describe("games and points", () => {
  it("turns every singles into its games, numbered within the match", () => {
    const games = gamesOf(singles);
    expect(games).toHaveLength(9 * 3 + 1 + 2); // two four- and five-game singles
    expect(games.filter((game) => game.number === 5)).toHaveLength(1);
  });

  it("counts games by margin, signed, with nothing at ±1", () => {
    const counts = marginCounts(gamesOf(singles));
    expect(counts.some((row) => Math.abs(row.margin) < 2)).toBe(false);
    // 13–11 and 12–10 are two deuce wins; 9–11 three times among the losses.
    expect(counts.find((row) => row.margin === 2)!.count).toBeGreaterThanOrEqual(2);
    expect(counts.reduce((sum, row) => sum + row.count, 0)).toBe(gamesOf(singles).length);
  });

  it("counts the tight moments", () => {
    const [deuce, decider, behind] = pressure(singles);
    expect(deuce).toMatchObject({ won: 2, lost: 0 });
    expect(decider).toMatchObject({ won: 0, lost: 1 });
    // Came back against Simon Parker; lost game one to the visitor and lost.
    expect(behind).toMatchObject({ won: 1, lost: 1 });
  });

  it("adds up the share of points each night", () => {
    const share = pointsShare(nights);
    expect(share[0]!.for).toBe(11 + 11 + 13 + 8 + 11 + 12 + 11 + 33);
    expect(share.every((row) => row.share > 0 && row.share < 100)).toBe(true);
  });
});

describe("who and where", () => {
  it("groups results by the opponent's own win rate", () => {
    const bands = byOpponentStrength(singles, STATISTICS.opponentRates);
    expect(bands.map((band) => band.label)).toEqual([
      "Opponents under 40%",
      "40% to 69%",
      "70% and over",
      "No average known",
    ]);
    expect(bands.find((band) => band.label === "No average known")).toMatchObject({ won: 0, lost: 1 });
  });

  it("leaves out a band nobody fell into", () => {
    expect(byOpponentStrength([rubber()], {}).map((band) => band.label)).toEqual(["No average known"]);
  });

  it("splits home and away", () => {
    expect(homeAndAway(singles)).toEqual([
      { label: "At home", won: 6, lost: 0 },
      { label: "Away", won: 1, lost: 2 },
    ]);
  });

  it("counts the doubles by partner, the most-played first", () => {
    expect(doublesByPartner(RUBBERS)).toEqual([
      { label: "Chris Wade", won: 1, lost: 1 },
      { label: "Sandy Nash", won: 1, lost: 0 },
    ]);
  });

  it("puts the opponents met most at the top of the head to head", () => {
    const rows = headToHead(singles, STATISTICS.opponentRates);
    expect(rows[0]!.results).toHaveLength(2);
    expect(rows.find((row) => row.opponent === "A Visitor")).toMatchObject({ slug: null, rate: null });
    const okai = rows.find((row) => row.opponent === "Reuben Okai")!;
    expect(okai).toMatchObject({ rate: 89, gamesFor: 6, gamesAgainst: 0 });
  });
});

describe("seasons and the division", () => {
  it("adds up a career", () => {
    expect(careerTotals(STATISTICS.seasons)).toEqual([
      { season: "2025-26", won: 22, lost: 2 },
      { season: "2026-27", won: 29, lost: 4 },
    ]);
  });

  it("says how many eligible players finished above", () => {
    const { above, eligible, me } = divisionSpread(STATISTICS.peers!.players, "derek-balding");
    expect(me?.memberName).toBe("Derek Balding");
    expect(above).toBe(1);
    expect(eligible).toHaveLength(4);
  });

  it("finds the team-mates", () => {
    expect(teamMates(STATISTICS.peers!.players, "hrc-a").map((peer) => peer.memberName)).toEqual([
      "Derek Balding",
      "Chris Wade",
    ]);
  });

  it("prints a placing as the league does", () => {
    expect([ordinal(1), ordinal(2), ordinal(3), ordinal(4), ordinal(11), ordinal(22), ordinal(3, true)]).toEqual([
      "1st",
      "2nd",
      "3rd",
      "4th",
      "11th",
      "22nd",
      "=3rd",
    ]);
  });
});

describe("divisions over the years", () => {
  const label = (division: string) => ({ premier: "Premier Division", division_1: "Division 1", division_2: "Division 2" })[division]!;
  const at = (seasonLabel: string, division: "premier" | "division_1" | "division_2" | null) => ({ seasonLabel, division });

  it("groups consecutive seasons in one division", () => {
    const runs = divisionRuns([at("2021-22", "division_1"), at("2022-23", "division_1"), at("2023-24", "premier")]);
    expect(runs).toEqual([
      { division: "division_1", from: "2021-22", to: "2022-23", seasons: 2 },
      { division: "premier", from: "2023-24", to: "2023-24", seasons: 1 },
    ]);
  });

  it("tells the story in a sentence", () => {
    expect(divisionStory([at("2021-22", "premier"), at("2022-23", "premier")], label)).toBe(
      "Premier Division every season on record.",
    );
    expect(
      divisionStory([at("2021-22", "division_1"), at("2022-23", "division_1"), at("2023-24", "premier"), at("2024-25", "division_1")], label),
    ).toBe("Division 1 from 2021-22 to 2022-23, Premier Division in 2023-24, then Division 1 in 2024-25.");
  });

  it("keeps the axis label short", () => {
    expect([divisionShort("premier"), divisionShort("division_1"), divisionShort("division_2"), divisionShort(null)]).toEqual([
      "Premier",
      "Div 1",
      "Div 2",
      "—",
    ]);
  });
});
