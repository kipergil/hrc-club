import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseArchiveSeasonLabel, parseArchivedSeason, parseFinalTables, tidyTeamName } from "./parse-archive.js";

/**
 * Five captured seasons, chosen because each one breaks a different
 * assumption:
 *
 *  - **2011-12** wraps every cell in a `<p>` and leaves a trailing empty
 *    cell on some rows. Read naively it yields a table with no rows, or
 *    one row; both look like a thin season rather than a broken parse.
 *  - **2018-19** ran two divisions, not three. A parser that insists on
 *    three is wrong about a third of the archive.
 *  - **2019-20** was abandoned in March 2020, and says so only through a
 *    background image. Its uneven `played` counts are the giveaway.
 *  - **2020-21** was cancelled outright and has prose but no tables.
 *  - **2025-26** is the current shape, and the one the numbers can be
 *    checked against by hand.
 */
function load(name: string): string {
  return new TextDecoder("windows-1252").decode(
    readFileSync(path.join(import.meta.dirname, `__fixtures__/${name}`)),
  );
}

const tables2025 = load("tables-2025.htm");
const tables2011 = load("tables-2011.htm");
const tables2018 = load("tables-2018.htm");
const tables2019 = load("tables-2019.htm");
const tables2020 = load("tables-2020.htm");

describe("parseFinalTables", () => {
  it("reads all three divisions of a current season", () => {
    const divisions = parseFinalTables(tables2025);
    expect(divisions.map((d) => d.division)).toEqual(["premier", "division_one", "division_two"]);
    expect(divisions.map((d) => d.rows.length)).toEqual([8, 7, 8]);
  });

  it("reads the champions exactly as the page has them", () => {
    const [premier] = parseFinalTables(tables2025);
    /*
     * Water Lane A, 118 points from fourteen matches. Worth pinning
     * because it is also the check on the scoring model: points are
     * rubbers won, ten to a match, so 118 from 14 is a team that won
     * roughly six rubbers in seven — not 118 match points, which would be
     * impossible.
     */
    expect(premier!.rows[0]).toEqual({ teamName: "Water Lane A", played: 14, points: 118 });
  });

  it("keeps teams tied on points in the order the league placed them", () => {
    // HRC B and Grundy Park B both finished on 47. The league applied rule
    // 20 and put HRC B higher; the archive is the league's answer, so the
    // order on the page is the order that ships.
    const [premier] = parseFinalTables(tables2025);
    const names = premier!.rows.map((row) => row.teamName);
    expect(names.indexOf("HRC B")).toBeLessThan(names.indexOf("Grundy Park B"));
    expect(premier!.rows.filter((row) => row.points === 47)).toHaveLength(2);
  });

  it("survives the 2011 markup, where every cell is a paragraph", () => {
    const divisions = parseFinalTables(tables2011);
    expect(divisions.map((d) => d.rows.length)).toEqual([7, 6, 6]);
    expect(divisions[0]!.rows[0]).toEqual({ teamName: "Grundy Park 1", played: 18, points: 124 });
  });

  it("reads a row that ends with an empty cell", () => {
    // Three of 2011's Division 2 rows carry a trailing spacer cell.
    // Requiring the line to end at the points column drops them, leaving
    // a division with one team in it.
    const divisions = parseFinalTables(tables2011);
    const names = divisions[2]!.rows.map((row) => row.teamName);
    expect(names).toContain("Hoddesdon 3");
    expect(names).toContain("Cheshunt 5");
  });

  it("accepts a season that ran only two divisions", () => {
    const divisions = parseFinalTables(tables2018);
    expect(divisions.map((d) => d.division)).toEqual(["premier", "division_one"]);
    expect(divisions.every((d) => d.rows.length === 8)).toBe(true);
  });

  it("returns nothing for a season that was never played", () => {
    // 2020-21 is prose only. An empty result here is correct; the importer
    // is what must not treat it as a failed fetch.
    expect(parseFinalTables(tables2020)).toEqual([]);
  });

  it("does not mistake prose about a division for a table heading", () => {
    /*
     * The 2015 and 2019 pages open with a paragraph naming the divisions
     * in running text. Anchoring on the heading rather than the header row
     * picks that prose up and attaches the wrong division to a table.
     */
    const divisions = parseFinalTables(tables2019);
    expect(divisions.map((d) => d.division)).toEqual(["premier", "division_one", "division_two"]);
    expect(divisions[0]!.rows[0]!.teamName).toBe("HRC 1");
  });
});

describe("parseArchivedSeason", () => {
  it("labels a season by the year it started", () => {
    expect(parseArchivedSeason(tables2025, 2025).label).toBe("2025-26");
  });

  it("falls back to the year in the file name when the page does not say", () => {
    expect(parseArchiveSeasonLabel("<p>League Tables</p>", 2016)).toBe("2016-17");
  });

  it("marks the cancelled season, and the abandoned one", () => {
    expect(parseArchivedSeason(tables2020, 2020).incomplete).toBe("cancelled");
    expect(parseArchivedSeason(tables2019, 2019).incomplete).toBe("abandoned");
  });

  it("does not mark a season that simply finished", () => {
    expect(parseArchivedSeason(tables2025, 2025).incomplete).toBeNull();
  });

  it("flags the abandoned season through its uneven match counts too", () => {
    // The clubs played between nine and fourteen matches before it stopped.
    // A finished season has one figure across the division.
    const [premier] = parseFinalTables(tables2019);
    const played = new Set(premier!.rows.map((row) => row.played));
    expect(played.size).toBeGreaterThan(1);
  });
});

describe("tidyTeamName", () => {
  it("leaves the league's own casing alone", () => {
    expect(tidyTeamName("HRC A")).toBe("HRC A");
    expect(tidyTeamName("St. Andrews B")).toBe("St. Andrews B");
    expect(tidyTeamName("PramaStars A")).toBe("PramaStars A");
  });

  it("calms down the 2015 page, which shouts", () => {
    expect(tidyTeamName("ALLENBURYS 1")).toBe("Allenburys 1");
    expect(tidyTeamName("GRUNDY PARK 3")).toBe("Grundy Park 3");
  });

  it("keeps a trailing team letter as a letter", () => {
    expect(tidyTeamName("WATER LANE A")).toBe("Water Lane A");
  });
});
