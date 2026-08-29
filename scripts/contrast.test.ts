import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The palette, checked rather than asserted in a comment.
 *
 * This site's premise is that the accessibility requirements are design
 * tokens: the league PRD's §7 asks for AAA body-text contrast because its
 * readers are, in the main, over sixty. A redesign is exactly the moment
 * that quietly stops being true — a colour gets nudged for looks, the
 * comment above it still claims 7.4:1, and nobody finds out.
 *
 * So the ratios are computed from the CSS itself. Change a token in
 * index.css and this test either agrees or fails.
 */

const css = readFileSync(new URL("../client/src/index.css", import.meta.url), "utf8");

/**
 * Pulls one `--c-*: r g b` block out of the stylesheet.
 *
 * The tokens hold bare channel triplets rather than hex so that Tailwind's
 * `rgb(var(--c-x) / <alpha-value>)` form works — which is what makes
 * `border-accent/30` and the like resolve at all. Written as hex, an
 * opacity modifier is not merely ignored: the class does not exist, so the
 * border silently falls back to `currentColor`.
 */
function readTokens(selector: string): Record<string, string> {
  const start = css.indexOf(selector);
  if (start < 0) throw new Error(`No ${selector} block in index.css`);
  const open = css.indexOf("{", start);
  const end = css.indexOf("}", open);
  const block = css.slice(open, end);
  const tokens: Record<string, string> = {};
  for (const match of block.matchAll(/--c-([a-z-]+):\s*(\d{1,3} \d{1,3} \d{1,3})\s*;/g)) {
    tokens[match[1]!] = match[2]!;
  }
  return tokens;
}

function luminance(triplet: string): number {
  const channels = triplet.split(/\s+/).map((value) => Number(value) / 255);
  const [r, g, b] = channels.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
}

export function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light! + 0.05) / (dark! + 0.05);
}

/**
 * Each pair names the requirement it exists for, so a failure says which
 * rule broke rather than only which numbers moved.
 *
 * AAA is 7:1 for body text and 4.5:1 for large text (WCAG 1.4.6); 3:1 is
 * the floor for UI component boundaries and focus indicators (1.4.11).
 */
const PAIRS: Array<[fg: string, bg: string, min: number, what: string]> = [
  ["ink", "canvas", 7, "body text on the page"],
  ["ink", "surface", 7, "body text on a card"],
  ["ink", "surface-sunken", 7, "body text on a sunken panel"],
  ["ink-muted", "canvas", 7, "secondary text on the page"],
  ["ink-muted", "surface", 7, "secondary text on a card"],
  ["ink-muted", "surface-sunken", 7, "secondary text on a sunken panel"],
  ["brand", "surface", 7, "a link on a card"],
  ["brand", "canvas", 7, "a link on the page"],
  ["brand", "brand-soft", 4.5, "a link on its own tint"],
  ["brand-ink", "brand", 7, "text on a filled primary button"],
  ["accent-ink", "accent", 4.5, "text on a filled accent"],
  ["accent", "canvas", 7, "accent text on the page"],
  ["accent", "accent-soft", 4.5, "accent text on its own tint"],
  ["positive", "canvas", 7, "a positive result"],
  ["positive", "positive-soft", 4.5, "a positive result on its tint"],
  ["negative", "canvas", 7, "a negative result"],
  ["negative", "negative-soft", 4.5, "a negative result on its tint"],
  ["focus", "canvas", 3, "the focus ring against the page"],
  ["focus", "surface", 3, "the focus ring against a card"],
  ["line-strong", "surface", 3, "an input border against a card"],
  ["line-strong", "canvas", 3, "an input border against the page"],
];

for (const [theme, selector] of [
  ["light", ":root {"],
  ["dark", ':root[data-theme="dark"]'],
] as const) {
  describe(`${theme} palette`, () => {
    const tokens = readTokens(selector);

    for (const [fg, bg, min, what] of PAIRS) {
      it(`${what}: ${fg} on ${bg} is at least ${min}:1`, () => {
        const a = tokens[fg];
        const b = tokens[bg];
        expect(a, `--c-${fg} is missing from the ${theme} palette`).toBeTruthy();
        expect(b, `--c-${bg} is missing from the ${theme} palette`).toBeTruthy();
        expect(contrast(a!, b!)).toBeGreaterThanOrEqual(min);
      });
    }
  });
}

describe("the two palettes stay in step", () => {
  it("defines exactly the same tokens in dark as in light", () => {
    // A token defined in one theme and not the other renders as whatever
    // the light value was, which is how a dark mode grows a single
    // blinding element that nobody notices in review.
    expect(Object.keys(readTokens(':root[data-theme="dark"]')).sort()).toEqual(
      Object.keys(readTokens(":root {")).sort(),
    );
  });

  it("writes every token as a channel triplet, so opacity modifiers resolve", () => {
    // A hex value here compiles, renders, and looks right — until the first
    // `/30` somewhere in a component quietly produces no class at all.
    for (const [theme, selector] of [
      ["light", ":root {"],
      ["dark", ':root[data-theme="dark"]'],
    ] as const) {
      const tokens = readTokens(selector);
      expect(Object.keys(tokens).length, `the ${theme} palette parsed as empty`).toBeGreaterThan(10);
      for (const [name, value] of Object.entries(tokens)) {
        expect(value, `--c-${name} in the ${theme} palette`).toMatch(/^\d{1,3} \d{1,3} \d{1,3}$/);
      }
    }
  });

  it("gives the media-query fallback the same values as the explicit dark theme", () => {
    // The site has three theme states: explicit dark, explicit light, and
    // system. The system branch is a copy of the dark block, and a copy is
    // a thing that drifts.
    expect(readTokens("@media (prefers-color-scheme: dark)")).toEqual(
      readTokens(':root[data-theme="dark"]'),
    );
  });
});
