import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { parseAveragesPage, parseHandicapsPage } from "./parse-averages.js";

const read = (name: string) =>
  new TextDecoder("windows-1252").decode(readFileSync(new URL(`./__fixtures__/${name}`, import.meta.url)));

describe("the league's final averages page", () => {
  const page = parseAveragesPage(read("averages-2025.htm"));

  it("reads the season from the page itself", () => {
    expect(page.seasonLabel).toBe("2025-26");
  });

  it("reads all three divisions, in the order the page names them", () => {
    expect(page.divisions.map((d) => d.division)).toEqual(["premier", "division_1", "division_2"]);
    expect(page.divisions.map((d) => d.players.length)).toEqual([51, 46, 50]);
  });

  it("reads a player's whole row, including what the tooltips carry", () => {
    const derek = page.divisions[0]!.players.find((p) => p.name === "Derek Balding");
    expect(derek).toEqual({
      name: "Derek Balding",
      club: "HRC",
      played: 24,
      won: 22,
      lost: 2,
      winPercentage: 92,
      matchesPlayed: 8,
      teamMatches: 14,
      eligible: true,
    });
  });

  it("marks a greyed-out player as below the 50% rule, not as missing", () => {
    const gurjit = page.divisions[0]!.players.find((p) => p.name === "Gurjit Bhambra")!;
    expect(gurjit).toMatchObject({ played: 18, won: 17, matchesPlayed: 6, eligible: false });
  });

  it("adds up on every row: won and lost make played", () => {
    for (const { players } of page.divisions) {
      for (const p of players) expect(p.won + p.lost, p.name).toBe(p.played);
    }
  });

  it("refuses a page whose tables and headings do not line up", () => {
    const broken = read("averages-2025.htm").replace(/Division Two<\/font>/, "</font>");
    expect(() => parseAveragesPage(broken)).toThrow(/layout has changed/);
  });
});

describe("the league's handicaps page", () => {
  const { handicaps, ambiguous } = parseHandicapsPage(read("handicaps-2025.htm"));

  it("reads each player's handicap, negatives included", () => {
    expect(handicaps.get("Derek Balding")).toBe(-2);
    expect(handicaps.get("Andy Nash")).toBe(-3);
    expect(handicaps.get("Mustafa Kipergil")).toBe(11);
  });

  it("leaves out 99, the league's not-yet-rated", () => {
    expect(handicaps.has("Chris Wade")).toBe(false);
    expect([...handicaps.values()]).not.toContain(99);
  });

  it("finds a good number of players and no clashes on this page", () => {
    expect(handicaps.size).toBeGreaterThan(100);
    expect(ambiguous).toEqual([]);
  });
});
