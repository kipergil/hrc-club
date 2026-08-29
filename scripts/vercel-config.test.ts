import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * `vercel.json` is validated against a schema at deploy time, and the
 * schema forbids properties it does not know about. That makes the file
 * one of the few in this repository where a comment is not free: a `"//"`
 * key added beside the headers block to explain it failed schema
 * validation, and every deployment — production included — errored for a
 * day before anyone looked.
 *
 * Nothing else in the build reads this file, so nothing else would catch
 * it. These are the cheap checks that would have.
 */

const raw = readFileSync(new URL("../vercel.json", import.meta.url), "utf8");
const config = JSON.parse(raw) as Record<string, unknown>;

/** Walks every object in the tree, so a stray key anywhere is found. */
function* objects(value: unknown, path = "vercel.json"): Generator<[string, Record<string, unknown>]> {
  if (Array.isArray(value)) {
    for (const [index, item] of value.entries()) yield* objects(item, `${path}[${index}]`);
  } else if (value && typeof value === "object") {
    yield [path, value as Record<string, unknown>];
    for (const [key, item] of Object.entries(value)) yield* objects(item, `${path}.${key}`);
  }
}

describe("vercel.json", () => {
  it("carries no comment keys, which the deploy-time schema rejects", () => {
    for (const [path, object] of objects(config)) {
      for (const key of Object.keys(object)) {
        expect(
          /^\/\/|^#|^_comment/.test(key),
          `${path} has a comment key "${key}". Vercel rejects unknown properties — put the explanation in the code it describes instead.`,
        ).toBe(false);
      }
    }
  });

  it("keeps the page security headers the API's helmet config cannot reach", () => {
    // Helmet only covers what Express serves, which on Vercel is /api/*.
    // If this block goes, every HTML page silently loses its CSP.
    const headers = config.headers as Array<{ source: string; headers: Array<{ key: string }> }>;
    expect(headers?.length).toBeGreaterThan(0);

    const catchAll = headers.find((entry) => entry.source === "/(.*)");
    expect(catchAll, "no catch-all headers rule for pages").toBeTruthy();

    const keys = catchAll!.headers.map((header) => header.key);
    for (const required of [
      "Content-Security-Policy",
      "X-Content-Type-Options",
      "X-Frame-Options",
      "Referrer-Policy",
    ]) {
      expect(keys).toContain(required);
    }
  });

  it("keeps script-src at 'self' — the prerendered state rides in a JSON block for this reason", () => {
    const headers = config.headers as Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
    const csp = headers
      .find((entry) => entry.source === "/(.*)")!
      .headers.find((header) => header.key === "Content-Security-Policy")!.value;

    expect(csp).toContain("script-src 'self'");
    expect(csp).not.toContain("script-src 'self' 'unsafe-inline'");
  });
});
