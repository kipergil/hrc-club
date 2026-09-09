import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { isKnownRoute } from "@shared/routes.js";
import { PRINTABLE_PAGES, PRINTABLE_SECTIONS, isPrintable } from "./print";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The print button moved from beside each page's title into the footer
 * navigation, which `Layout` renders rather than the page. That trades a
 * prop each page passes for a list — and a list is the kind of thing that
 * goes quietly wrong when a route is renamed, so it is checked against the
 * router rather than trusted.
 */

/** Static route paths, read from the router itself. */
function staticRoutes(): Set<string> {
  const source = readFileSync(path.join(here, "../App.tsx"), "utf8");
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]!);
  return new Set(paths.filter((route) => !route.includes(":")));
}

describe("which pages offer printing", () => {
  it("names only pages the site actually serves", () => {
    const known = staticRoutes();
    // A parse that matched nothing would make the assertion vacuous.
    expect(known.size).toBeGreaterThan(15);

    for (const page of PRINTABLE_PAGES) {
      expect(known, `${page} is listed as printable but is not a route`).toContain(page);
    }
  });

  it("covers the pages that carried a print button before it moved", () => {
    /*
     * The set is not a new decision — it is exactly what each page used to
     * pass as `actions={<PrintButton />}`. Losing one would take printing
     * off a page silently, which is the sort of thing nobody reports.
     */
    for (const page of [
      "/fixtures",
      "/fixtures/calendar",
      "/results",
      "/tables",
      "/averages",
      "/clubs",
      "/venues",
      "/honours",
    ]) {
      expect(isPrintable(page), `${page} should offer printing`).toBe(true);
    }
  });

  it("offers it on a club's details and a team's fixtures", () => {
    expect(isPrintable("/clubs/water-lane")).toBe(true);
    expect(isPrintable("/teams/water-lane-c")).toBe(true);
  });

  it("does not offer it where nobody would print", () => {
    for (const page of [
      "/",
      "/contact",
      "/admin/scorecards",
      "/help",
      "/news",
      "/whats-new",
      "/handicaps",
      "/players",
      // The team list had no print button; a single team's fixtures did.
      "/teams",
    ]) {
      expect(isPrintable(page), `${page} should not offer printing`).toBe(false);
    }
  });

  it("treats a trailing slash as the same page", () => {
    // Otherwise "/tables/" is a page whose button quietly vanished.
    expect(isPrintable("/tables/")).toBe(true);
    expect(isPrintable("/clubs/")).toBe(true);
    expect(isPrintable("/")).toBe(false);
  });

  it("does not mistake a section prefix for a page under it", () => {
    // "/teams" is the list and prints nothing; only a slug beneath it does.
    for (const section of PRINTABLE_SECTIONS) {
      expect(isPrintable(section.replace(/\/$/, ""))).toBe(
        PRINTABLE_PAGES.includes(section.replace(/\/$/, "")),
      );
    }
  });

  it("only claims routes the server will serve rather than 404", () => {
    // A printable path the server does not recognise would be a button on
    // a page that never renders.
    for (const page of [...PRINTABLE_PAGES, "/clubs/water-lane", "/teams/water-lane-c"]) {
      expect(isKnownRoute(page), `${page} is not a known route segment`).toBe(true);
    }
  });
});
