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

  it("keeps the names players already use", () => {
    const titles = ALL_LINKS.map((link) => link.title);
    expect(titles).toContain("League tables");
    expect(titles).toContain("Fixture calendar");
    expect(titles).toContain("Match history");
    expect(titles).toContain("Averages");
    expect(titles).toContain("Handicaps");
  });

  it("has no duplicate destinations", () => {
    const hrefs = ALL_LINKS.map((link) => link.href);
    expect(new Set(hrefs).size).toBe(hrefs.length);
  });

  it("resolves a path to its group for the breadcrumb trail", () => {
    expect(findGroup("/tables")?.label).toBe("Teams");
    expect(findGroup("/news/some-article")?.label).toBe("News");
    expect(findGroup("/play/venue/main-hall")?.label).toBe("Play");
    expect(findLink("/tables")?.title).toBe("League tables");
  });
});
