import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { parseClubPage, parseVenue } from "./parse-club-page.js";

/**
 * The fixture is a real capture of `Clubz.asp?Club=HRC` — Microsoft
 * FrontPage output from a Classic ASP page that nobody has promised to keep
 * stable, and which is due to be rebuilt entirely. These tests are what
 * turn "the import quietly produced an empty club" into a failing build.
 */
const fixture = readFileSync(
  path.join(import.meta.dirname, "__fixtures__/clubz-hrc.html"),
  "latin1",
);

describe("parseClubPage", () => {
  const club = parseClubPage(fixture);

  it("finds all four teams with their divisions", () => {
    expect(club.teams.map((t) => [t.name, t.division])).toEqual([
      ["HRC A", "premier"],
      ["HRC B", "premier"],
      ["HRC C", "division_1"],
      ["HRC D", "division_2"],
    ]);
  });

  it("reads the home night", () => {
    expect(club.teams.every((t) => t.homeNight === "wednesday")).toBe(true);
  });

  it("reads each team's captain", () => {
    expect(club.teams.map((t) => t.captain)).toEqual([
      "Neil Skull",
      "Sunil Trakru",
      "Dudu Souleiman",
      "Jo Swain",
    ]);
  });

  /**
   * The players table interleaves spacer cells between the four columns.
   * Dropping the empties instead of mapping by header index shifts every
   * squad one team to the left — which parses without error and is
   * completely wrong, so it gets its own test.
   */
  it("attaches each squad to the right team", () => {
    const byTeam = Object.fromEntries(club.teams.map((t) => [t.name, t.players]));
    expect(byTeam["HRC A"]).toContain("Neil Skull");
    expect(byTeam["HRC B"]).toContain("Sunil Trakru");
    expect(byTeam["HRC C"]).toContain("Dudu Souleiman");
    expect(byTeam["HRC D"]).toContain("Jo Swain");
    // Every captain plays for the team they captain.
    for (const team of club.teams) {
      expect(team.players).toContain(team.captain);
    }
  });

  it("de-duplicates a player the league lists twice", () => {
    const hrcC = club.teams.find((t) => t.name === "HRC C")!;
    expect(hrcC.players.filter((p) => p === "Gideon Alao")).toHaveLength(1);
    expect(new Set(hrcC.players).size).toBe(hrcC.players.length);
  });

  it("reads the venue and the league's own last-updated stamp", () => {
    expect(club.venue).toContain("Bushby Hall");
    expect(club.venue).toContain("EN10 6HX");
    expect(club.updatedAt).toBeTruthy();
  });

  it("refuses a page it does not recognise rather than importing an empty club", () => {
    expect(() => parseClubPage("<html><body>Service unavailable</body></html>")).toThrow();
  });
});

describe("parseVenue", () => {
  it("splits the league's single-line address into fields", () => {
    expect(parseVenue("Bushby Hall, 8 Wharf Road, Wormley, Herts. EN10 6HX")).toEqual({
      name: "Bushby Hall",
      addressLine1: "8 Wharf Road",
      // The town, not the county — "Herts" is no use to someone driving there.
      town: "Wormley",
      postcode: "EN10 6HX",
    });
  });

  it("copes with an address that has no postcode", () => {
    expect(parseVenue("Some Hall, High Street, Hertford").postcode).toBeNull();
  });
});
