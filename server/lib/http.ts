import type { NextFunction, Request, RequestHandler, Response } from "express";

/**
 * Cache-Control policy, expressed once as the three tiers the architecture
 * document defines rather than as a scattering of magic numbers.
 *
 * `s-maxage` is what Vercel's CDN reads; `stale-while-revalidate` is what
 * makes a match-night burst cheap — the first request after the TTL expires
 * still gets an instant (slightly stale) response while exactly one request
 * goes to the origin to refresh it.
 */
export const CACHE = {
  /** Tier A — content that changes a few times a season. */
  static: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  /** Tier B — changes when a result is confirmed. */
  dynamic: "public, max-age=0, s-maxage=600, stale-while-revalidate=3600",
  /** Tier B, slower-moving — squads, profiles, albums. */
  slow: "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400",
  /** Tier C — anything behind a sign-in, or anything a person just submitted. */
  none: "private, no-store",
} as const;

export type CachePolicy = (typeof CACHE)[keyof typeof CACHE];

export function cache(res: Response, policy: CachePolicy): void {
  res.setHeader("Cache-Control", policy);
}

export function ok<T>(res: Response, data: T, policy: CachePolicy = CACHE.dynamic): void {
  cache(res, policy);
  res.json({ data });
}

/** 404 with a sentence rather than a status code, per the PRD's error-message rule. */
export function notFound(res: Response, what: string): void {
  cache(res, CACHE.none);
  res.status(404).json({
    message: `We couldn't find that ${what}. It may have been renamed or removed — try the menu above.`,
  });
}

/**
 * Express 4 does not forward a rejected promise to the error handler, so an
 * async route that throws would otherwise hang the request until it timed
 * out. Every async handler is wrapped.
 */
export function handler(
  fn: (req: Request, res: Response) => Promise<unknown>,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res).catch(next);
  };
}

/** Reads a query parameter that should be a single string, ignoring arrays. */
export function param(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
