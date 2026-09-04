import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { FEATURE_POSTS } from "./feature-posts.js";

const here = path.dirname(fileURLToPath(import.meta.url));

/**
 * The routes the site actually serves, read from the router itself.
 *
 * The menu would be the easier list to check against, but it is the wrong
 * one: `/admin/scorecards` is a real page deliberately kept out of the
 * menu, and checking against the menu would either reject a good link or
 * push the post into not linking the page it is about. The router is the
 * thing a reader's click meets.
 *
 * Parameterised routes are dropped — a post should not be linking to one
 * particular team or one particular card, and a rule that lets it is a
 * rule that lets the post rot.
 */
function staticRoutes(): Set<string> {
  const source = readFileSync(path.join(here, "../../../client/src/App.tsx"), "utf8");
  const paths = [...source.matchAll(/<Route\s+path="([^"]+)"/g)].map((match) => match[1]!);
  return new Set(paths.filter((route) => !route.includes(":")));
}

/**
 * These posts are the site describing itself, which makes them the one
 * piece of content that goes stale when the site changes. A renamed route
 * or a retired word leaves a published post quietly wrong, and nothing
 * else in the build would notice — the text lives in Directus by then.
 *
 * So the checks that can be mechanical are mechanical.
 */

/** Every `](/…)` target in a post body, deduplicated. */
function internalLinks(body: string): string[] {
  return [...new Set([...body.matchAll(/\]\((\/[^)\s]*)\)/g)].map((match) => match[1]!))];
}

describe("the feature posts", () => {
  it("only links to pages the site actually has", () => {
    const known = staticRoutes();
    // A sanity check on the parse itself: a regex that matched nothing
    // would make the assertion below vacuously true.
    expect(known.size).toBeGreaterThan(15);
    expect(known).toContain("/whats-new");

    for (const post of FEATURE_POSTS) {
      for (const href of internalLinks(post.body)) {
        expect(known, `${post.slug} links to ${href}`).toContain(href);
      }
    }
  });

  it("links somewhere from every post", () => {
    // A post that explains a feature without saying where to find it has
    // failed at the only job it has.
    for (const post of FEATURE_POSTS) {
      expect(internalLinks(post.body).length, `${post.slug} has no links`).toBeGreaterThan(0);
    }
  });

  it("does not say 'rubber'", () => {
    /*
     * The league's own word for one of the ten matches, and the reason it
     * was dropped from the site: a rubber is the sheet on the bat. The
     * pages were reworded; a post reintroducing it would undo that in the
     * most visible place on the site.
     */
    for (const post of FEATURE_POSTS) {
      const text = `${post.title} ${post.summary} ${post.body}`.toLowerCase();
      expect(text, `${post.slug} uses "rubber"`).not.toMatch(/\brubbers?\b/);
    }
  });

  it("keeps every summary inside the field it has to fit", () => {
    // `hrc_news.summary` is capped at 300 characters, and Directus rejects
    // the write rather than truncating it.
    for (const post of FEATURE_POSTS) {
      expect(post.summary.length, `${post.slug} summary is too long`).toBeLessThanOrEqual(300);
      expect(post.summary.length).toBeGreaterThan(0);
    }
  });

  it("gives every post a distinct slug and title", () => {
    const slugs = FEATURE_POSTS.map((post) => post.slug);
    const titles = FEATURE_POSTS.map((post) => post.title);
    // The writer upserts on the slug, so a duplicate would silently
    // publish one post and overwrite it with another.
    expect(new Set(slugs).size).toBe(slugs.length);
    expect(new Set(titles).size).toBe(titles.length);
    for (const slug of slugs) expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
  });

  it("stays short", () => {
    // "Short and concise" is the brief. Four hundred words is a page a
    // reader scrolls past; these are meant to be read standing up.
    for (const post of FEATURE_POSTS) {
      const words = post.body.trim().split(/\s+/).length;
      expect(words, `${post.slug} is ${words} words`).toBeLessThan(400);
    }
  });
});
