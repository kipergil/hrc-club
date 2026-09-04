import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { CSP_DIRECTIVES } from "../server/lib/security.js";
import { PARSE_TIMEOUT_MS } from "../client/src/lib/admin.js";

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

  it("keeps the page policy in step with the one helmet applies to the API", () => {
    /*
     * Two copies of the same policy exist because they cover different
     * traffic: helmet's covers what Express serves, which on Vercel is
     * `/api/*`, and this file's covers every prerendered page. They are
     * meant to match, and until the venue maps needed a tile host added
     * to both, nothing checked that they did.
     */
    const headers = config.headers as Array<{
      source: string;
      headers: Array<{ key: string; value: string }>;
    }>;
    const csp = headers
      .find((entry) => entry.source === "/(.*)")!
      .headers.find((header) => header.key === "Content-Security-Policy")!.value;

    const imgSrc = csp
      .split(";")
      .map((directive) => directive.trim())
      .find((directive) => directive.startsWith("img-src "));

    expect(imgSrc, "vercel.json has no img-src directive").toBeTruthy();

    const listed = imgSrc!.slice("img-src ".length).split(/\s+/).sort();
    expect(listed).toEqual([...CSP_DIRECTIVES.imgSrc].sort());
  });
});

describe("the API function's budget", () => {
  /**
   * Reading a photographed card is a vision call: twenty to forty seconds
   * is ordinary. The platform's default ceiling is well under that, and
   * when it trips the request is killed at the edge — no error reaches the
   * app, nothing is logged, and the captain sees the upload stop for no
   * stated reason. That is the failure this value exists to prevent, and
   * nothing else in the build would notice it going away.
   */
  it("gives the API long enough to read a card", () => {
    const functions = config.functions as Record<string, { maxDuration?: number }> | undefined;
    expect(functions, "no functions block — the API gets the short default ceiling").toBeTruthy();

    const api = functions!["api/index.ts"];
    expect(api, "no entry for the API function").toBeTruthy();
    expect(api!.maxDuration ?? 0).toBeGreaterThanOrEqual(60);
  });

  it("does not promise the browser more patience than the server has", () => {
    // The client gives up at PARSE_TIMEOUT_MS. Set beyond the server's own
    // ceiling, the reader would sit watching a spinner for a minute after
    // the work had already been killed.
    const functions = config.functions as Record<string, { maxDuration?: number }>;
    const seconds = functions["api/index.ts"]!.maxDuration!;
    expect(PARSE_TIMEOUT_MS / 1000).toBeLessThanOrEqual(seconds + 30);
  });
});
