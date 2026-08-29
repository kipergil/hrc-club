import { describe, expect, it } from "vitest";
import { isKnownRoute } from "@shared/routes.js";
import { ALL_LINKS, NAV, findGroup, findLink, findSection } from "./nav";

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

  /**
   * The server decides between "the app will render this once it boots" and
   * "this is a dead link, answer 404" from a list of path segments. A page
   * added to the menu but not to that list would be served the 404 page,
   * with a 404 status, while looking perfectly fine in the navigation.
   */
  it("has a server-side route entry for every page in the menu", () => {
    for (const link of ALL_LINKS) {
      expect(isKnownRoute(link.href), `${link.href} is in the menu but not in KNOWN_ROUTE_SEGMENTS`).toBe(
        true,
      );
    }
  });

  it("treats a path with no route as unknown", () => {
    expect(isKnownRoute("/nope")).toBe(false);
    expect(isKnownRoute("/wp-admin")).toBe(false);
    // A section the app does route, but deeper than any prerendered page.
    expect(isKnownRoute("/results/8f2a-not-prerendered")).toBe(true);
    expect(isKnownRoute("/")).toBe(true);
  });

  /**
   * The breadcrumb trail is built from these. `findLink` only ever matched
   * a page exactly, so every detail page fell through it and its trail read
   * "Home › Clubs" — no section, and no mention of the thing the page is
   * about.
   */
  describe("findSection", () => {
    it("files a detail page under the menu entry it belongs to", () => {
      expect(findSection("/teams/water-lane-c")?.title).toBe("Teams");
      expect(findSection("/clubs/hrc")?.title).toBe("Club details");
      expect(findSection("/players/jo-swain")?.title).toBe("Players");
      expect(findSection("/results/8f2a")?.title).toBe("Match history");
      expect(findSection("/news/agm-notice")?.title).toBe("Special notices");
    });

    it("returns the page itself when it is a menu entry", () => {
      expect(findSection("/tables")?.title).toBe("League tables");
    });

    it("does not let one section claim another whose path merely starts the same", () => {
      // "/newsletters".startsWith("/news") is true, and without a path
      // boundary a newsletter's trail says it is a special notice.
      expect(findSection("/newsletters")?.title).toBe("Newsletters");
      expect(findGroup("/newsletters")?.label).toBe("More");
    });

    it("has nothing to say about a page outside the menu", () => {
      // Policies are reachable from the footer, not the menu, and the trail
      // falls back to Home › the page's own name.
      expect(findSection("/privacy")).toBeUndefined();
      expect(findSection("/gallery/finals-night")).toBeUndefined();
    });
  });

  it("resolves a path to its group for the breadcrumb trail", () => {
    expect(findGroup("/tables")?.label).toBe("Tables");
    expect(findGroup("/news/some-article")?.label).toBe("More");
    expect(findGroup("/clubs/water-lane")?.label).toBe("Clubs");
    expect(findLink("/tables")?.title).toBe("League tables");
  });
});
