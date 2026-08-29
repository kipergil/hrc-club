import { describe, expect, it } from "vitest";
import { ALL_LINKS, NAV, findGroup, findLink } from "./nav";

describe("navigation", () => {
  /**
   * The league PRD caps the top navigation at five entries. The tuple type
   * already makes a sixth a compile error; this makes it a test failure
   * too, for anyone who reaches for a cast.
   */
  it("has exactly five top-level entries", () => {
    expect(NAV).toHaveLength(5);
  });

  it("gives every page a plain-English subtitle as well as its name", () => {
    for (const link of ALL_LINKS) {
      expect(link.title.length).toBeGreaterThan(0);
      expect(link.subtitle.length).toBeGreaterThan(0);
      // A subtitle that repeats the title is not an explanation.
      expect(link.subtitle.toLowerCase()).not.toBe(link.title.toLowerCase());
    }
  });

  /**
   * The PRD's binding constraint is "new look, same map": every page keeps
   * the name players already use on the league's own site. These are those
   * names, and a rename here is a rename of something people have
   * bookmarked.
   */
  it("keeps the names players already use", () => {
    const titles = ALL_LINKS.map((link) => link.title);
    for (const name of [
      "League tables",
      "Fixture calendar",
      "Match history",
      "Averages",
      "Handicaps",
      "Cup news",
      "Club details",
      "Special notices",
      "Newsletters",
      "Roll of honour",
      "Our links",
    ]) {
      expect(titles).toContain(name);
    }
  });

  it("uses the league's own five top-level groupings", () => {
    expect(NAV.map((group) => group.label)).toEqual(["Home", "Fixtures", "Tables", "Clubs", "More"]);
  });

  it("has no duplicate destinations", () => {
    const hrefs = ALL_LINKS.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("resolves a path to its group for the breadcrumb trail", () => {
    expect(findGroup("/tables")?.label).toBe("Tables");
    expect(findGroup("/news/some-article")?.label).toBe("More");
    expect(findGroup("/clubs/water-lane")?.label).toBe("Clubs");
    expect(findLink("/tables")?.title).toBe("League tables");
  });
});
