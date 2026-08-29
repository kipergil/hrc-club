import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseMatchHistory, parseSeasonLabel, toIsoDate } from "./parse-match-history.js";

/**
 * Against a captured copy of `MatchHistory.asp?Team=Water Lane C`, because
 * the way this parser fails is by returning nothing at all — which looks
 * exactly like a team with no fixtures yet, and would have imported a whole
 * empty season without a word of complaint.
 */
const source = new TextDecoder("windows-1252").decode(
  readFileSync(path.join(import.meta.dirname, "__fixtures__/match-history-water-lane-c.html")),
);

describe("parseMatchHistory", () => {
  const rows = parseMatchHistory(source);

  it("finds every match in the team's programme", () => {
    // Division One, nine teams, so sixteen matches — eight opponents home
    // and away. Counted off the page itself.
    expect(rows).toHaveLength(16);
  });

  it("reads the first fixture exactly as the page has it", () => {
    expect(rows[0]).toEqual({
      weekCommencing: "2026-09-21",
      homeTeam: "Ellenborough B",
      awayTeam: "Water Lane C",
      homeScore: null,
      awayScore: null,
    });
  });

  it("keeps home and away the right way round", () => {
    /*
     * The row carries an empty spacer cell between the two halves. Dropping
     * empty cells to tidy the row shifts the away team into the score
     * column — which parses without error and puts every match backwards.
     */
    const home = rows.filter((row) => row.homeTeam === "Water Lane C");
    const away = rows.filter((row) => row.awayTeam === "Water Lane C");
    expect(home).toHaveLength(8);
    expect(away).toHaveLength(8);
    expect(home.length + away.length).toBe(rows.length);
  });

  it("plays every other team in the division twice", () => {
    const opponents = rows.map((row) =>
      row.homeTeam === "Water Lane C" ? row.awayTeam : row.homeTeam,
    );
    const counts = new Map<string, number>();
    for (const opponent of opponents) counts.set(opponent, (counts.get(opponent) ?? 0) + 1);

    expect([...counts.keys()].sort()).toEqual([
      "Cheshunt B",
      "Cheshunt C",
      "Ellenborough B",
      "Grundy Park B",
      "Grundy Park C",
      "HRC C",
      "PramaStars A",
      "St. Andrews A",
    ]);
    expect([...counts.values()].every((count) => count === 2)).toBe(true);
  });

  it("leaves an unplayed match's score null rather than nil-nil", () => {
    // 0–0 is a result somebody played for. None of these have been played.
    expect(rows.every((row) => row.homeScore === null && row.awayScore === null)).toBe(true);
  });

  it("ignores the page's own furniture", () => {
    // The heading row says "W/C Date | Home Team | Score", and the closing
    // paragraph carries a date too.
    expect(rows.some((row) => /Home Team|Score/i.test(row.homeTeam))).toBe(false);
  });
});

describe("toIsoDate", () => {
  it("reads the league's date format", () => {
    expect(toIsoDate("21 Sep 2026")).toBe("2026-09-21");
    expect(toIsoDate("5 Oct 2026")).toBe("2026-10-05");
    expect(toIsoDate("12 Apr 2027")).toBe("2027-04-12");
  });

  it("returns null for anything that is not one", () => {
    expect(toIsoDate("W/C Date")).toBeNull();
    expect(toIsoDate("")).toBeNull();
    expect(toIsoDate("Water Lane C")).toBeNull();
  });
});

describe("parseSeasonLabel", () => {
  it("shortens the page's season to the form the site uses", () => {
    // The page says "2026-2027 Season"; seasons here are labelled "2026-27".
    expect(parseSeasonLabel(source)).toBe("2026-27");
  });
});
