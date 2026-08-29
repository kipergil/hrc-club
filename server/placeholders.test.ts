import { describe, expect, it } from "vitest";
import { isPlaceholder } from "./storage.js";

/**
 * `npm run seed` writes starter content so the layouts can be judged
 * against something realistic, and every body of it opens with the word
 * PLACEHOLDER. The seed's README says to replace it before the site is
 * public.
 *
 * That instruction held for the pages someone looked at and not for the
 * rest: the league's home page carried a seeded "Welcome to the new club
 * website", an invented match report, and a junior-coaching notice for a
 * club whose site this no longer is — each presented as real news. The
 * marker is now load-bearing, so it is worth a test of its own.
 */
describe("isPlaceholder", () => {
  it("recognises the marker the seed writes", () => {
    expect(isPlaceholder("PLACEHOLDER — replace this with the club's own words.")).toBe(true);
    expect(isPlaceholder("PLACEHOLDER article.\n\nThe club has a new website.")).toBe(true);
    expect(isPlaceholder("PLACEHOLDER.")).toBe(true);
  });

  it("tolerates the leading whitespace a rich-text editor leaves behind", () => {
    expect(isPlaceholder("\n  PLACEHOLDER — check these details.")).toBe(true);
  });

  it("leaves real content alone", () => {
    expect(isPlaceholder("Formed in 1936, the Hertford & District league…")).toBe(false);
    expect(isPlaceholder("The AGM is on 8th June at Thundridge Village Hall.")).toBe(false);
    expect(isPlaceholder(null)).toBe(false);
    expect(isPlaceholder(undefined)).toBe(false);
    expect(isPlaceholder("")).toBe(false);
  });

  it("only matches the marker at the start, not the word in passing", () => {
    // A committee member writing about the site itself should not have
    // their notice silently deleted.
    expect(isPlaceholder("We have replaced the PLACEHOLDER text on the about page.")).toBe(false);
  });

  it("does not treat a word that merely starts with it as the marker", () => {
    expect(isPlaceholder("PLACEHOLDERS are used throughout the draft.")).toBe(false);
  });
});
