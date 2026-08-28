import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  isTeamCompetition,
  parseHallOfFame,
  parseHomePage,
  parseRollOfHonour,
} from "./parse-league-pages.js";

/** The league site is Windows-1252; latin1 mangles its punctuation. */
function load(name: string): string {
  return new TextDecoder("windows-1252").decode(
    readFileSync(path.join(import.meta.dirname, `__fixtures__/${name}`)),
  );
}

describe("parseHomePage", () => {
  const home = parseHomePage(load("home.htm"));

  /**
   * The description does not begin its own line: the league's markup puts
   * the whole navigation and the prose in one cell, so it starts part-way
   * through a line of 800-odd characters. Anchoring to the start of a line
   * finds nothing, silently — which is how the league's description of
   * itself went missing from the built site once already.
   */
  it("finds the league's description of itself", () => {
    expect(home.about).toMatch(/Formed in 1936/);
    expect(home.about).toMatch(/13th oldest TT league/);
    expect(home.about).toMatch(/affiliated to Table Tennis England/);
  });

  it("joins wrapped lines into sentences rather than breaking them", () => {
    // The source wraps mid-sentence; a paragraph must not end on "and is".
    for (const paragraph of (home.about ?? "").split("\n\n")) {
      expect(paragraph).not.toMatch(/\band is$/);
    }
    expect(home.about).toMatch(/celebrates 90 years of Table Tennis this year and is quite probably/);
  });

  it("reads the committee, with and without an office", () => {
    expect(home.committee).toEqual([
      { name: "Jo Swain", role: "Chairperson" },
      { name: "Andy Reeve", role: "Treasurer" },
      { name: "Colin Bullworthy", role: "Match Secretary" },
      { name: "Gordon Imroth", role: null },
      { name: "John Barnes", role: null },
      { name: "Steve Hooker", role: null },
    ]);
  });

  it("reads the notice at the top of the page", () => {
    expect(home.announcement).toMatch(/AGM/);
    expect(home.welcome).toMatch(/Welcome to the 2026\/27 Season/);
    expect(home.lastUpdated).toBeTruthy();
  });

  it("collects the forms and documents, and the outward links", () => {
    const labels = home.documents.map((d) => d.label);
    expect(labels).toContain("Our Constitution (PDF)");
    expect(labels).toContain("Handbook (PDF)");
    expect(home.documents.every((d) => /\.(pdf|docx?)$/i.test(d.url))).toBe(true);
    expect(home.externalLinks.every((l) => /^https?:\/\//i.test(l.url))).toBe(true);
  });
});

describe("parseRollOfHonour", () => {
  const roll = parseRollOfHonour(load("roll-of-honour-2025-26.htm"));

  /**
   * Rows contain literal newlines in the source, so splitting the page on
   * newlines cuts every row into fragments and yields an empty season —
   * which is what five of the six seasons did before this was fixed.
   */
  it("reads a full season of winners and runners-up", () => {
    expect(roll.entries.length).toBeGreaterThanOrEqual(10);
    const premier = roll.entries.find((e) => /Premier Division/i.test(e.competition));
    expect(premier).toEqual({
      competition: "Premier Division",
      winner: "Water Lane A",
      runnerUp: "HRC A",
    });
  });

  /**
   * The league's link to its 2019-20 roll is dead, and the fixture is the
   * IIS 404 page it actually serves. That page is full of tables, so it
   * parsed into eight plausible-looking honours before this was guarded —
   * the worst kind of failure, because nothing about the result looks
   * wrong.
   */
  it("returns nothing for the error page a dead link actually serves", () => {
    const dead = parseRollOfHonour(load("roll-of-honour-404.htm"), "2019-20");
    expect(dead.entries).toEqual([]);
    expect(dead.seasonLabel).toBe("2019-20");
  });

  it("keeps individual awards that have no runner-up", () => {
    const pine = roll.entries.find((e) => /Pine Trophy/i.test(e.competition));
    expect(pine?.winner).toBe("Steve Hooker");
    expect(pine?.runnerUp).toBeNull();
  });
});

describe("parseHallOfFame", () => {
  const entries = parseHallOfFame(load("hall-of-fame.htm"));

  it("reads the whole record, back to the 1950s", () => {
    expect(entries.length).toBeGreaterThan(600);
    const years = entries.map((e) => e.year);
    expect(Math.min(...years)).toBeLessThanOrEqual(1970);
    expect(Math.max(...years)).toBeGreaterThanOrEqual(2025);
  });

  /**
   * The table is laid out with a column per decade, so one row holds 1972,
   * 1982, 1992 and so on side by side. The year is taken from the cell
   * rather than from its position, which is what makes that irrelevant.
   */
  it("attaches each winner to the right year and competition", () => {
    const creasey = entries.filter((e) => e.competition === "Creasey Cup");
    expect(creasey.length).toBeGreaterThan(50);
    expect(creasey.find((e) => e.year === 1972)?.winner).toBe("MSD TTC");
    expect(creasey.find((e) => e.year === 2022)?.winner).toBe("Water Lane A");
  });

  it("skips the years a competition was not played", () => {
    expect(entries.some((e) => /^no competition$/i.test(e.winner))).toBe(false);
  });

  it("names every competition it found", () => {
    const competitions = new Set(entries.map((e) => e.competition));
    expect(competitions.size).toBeGreaterThanOrEqual(15);
    expect(competitions).toContain("Creasey Cup");
    expect(competitions).toContain("Ladies Singles");
  });
});

describe("isTeamCompetition", () => {
  /**
   * A pattern over the name does not work: "Pine Trophy" is an individual
   * award and "MSD Trophy" is a team one, so matching on "Trophy" mislabels
   * one of them.
   */
  it("separates team competitions from individual ones by name, not by pattern", () => {
    expect(isTeamCompetition("Creasey Cup")).toBe(true);
    expect(isTeamCompetition("MSD Trophy")).toBe(true);
    expect(isTeamCompetition("Premier Division")).toBe(true);
    expect(isTeamCompetition("Pine Trophy")).toBe(false);
    expect(isTeamCompetition("Ladies Singles")).toBe(false);
    expect(isTeamCompetition("Division 1 Singles")).toBe(false);
  });
});
