import { timingSafeEqual } from "node:crypto";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { RequestHandler } from "express";
import { env } from "./env.js";
import * as storage from "../storage.js";

/**
 * Applies only to what Express serves. On Vercel that is `/api/*` and
 * nothing else — every HTML page is a prerendered static file the CDN
 * hands over directly, so these headers never touch it. The matching
 * policy for pages lives in `vercel.json`'s `headers` block, and the two
 * are meant to stay in step: change one, change the other.
 *
 * That note used to live in `vercel.json` itself, as a `"//"` key beside
 * the block it described. Vercel validates that file against a schema that
 * forbids unknown properties, so the comment did not document the
 * deployment — it broke it, and every build failed on the day it merged.
 * Deployment config takes its explanations here, in a file that has
 * somewhere to put them.
 *
 * The shared directives are exported so `scripts/vercel-config.test.ts`
 * can hold them against the copy in `vercel.json` and fail when the two
 * drift. "Meant to stay in step" was true and unchecked until the venue
 * maps needed a tile host added to both — which is the same shape as the
 * bug that took the deployment down: config that is wrong in a way no
 * test looks at.
 *
 * Images and documents are proxied from Directus through this same origin
 * (/api/files/:id), so the policy does not need to name the Directus host
 * at all — one fewer thing to update when it moves.
 */
export const CSP_DIRECTIVES = {
  defaultSrc: ["'self'"],
  // OpenStreetMap's tile server is the venue maps' basemap, and the only
  // third-party origin the site loads anything from. Tiles are images, so
  // this is all the access the map needs: `script-src` stays at 'self'
  // because Leaflet is bundled rather than pulled from a CDN, and
  // `connect-src` stays at 'self' because tiles arrive as <img>, not as
  // fetches.
  imgSrc: ["'self'", "data:", "https://tile.openstreetmap.org"],
} as const;

export function securityHeaders(): RequestHandler {
  return helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: [...CSP_DIRECTIVES.defaultSrc],
        imgSrc: [...CSP_DIRECTIVES.imgSrc],
        // `'unsafe-inline'` for styles only, and not by preference: React's
        // `style` prop and Radix's animation variables both set style
        // *attributes*, and CSP hashes do not apply to attributes — only a
        // nonce or 'unsafe-inline' works, and a nonce cannot be attached to
        // an attribute React writes. Without it the site loads with its
        // disclosure animations and measured widths dropped.
        //
        // The trade is deliberate and narrow: an injected style can restyle
        // the page, which is worth guarding against, but it cannot execute.
        // `script-src` stays at 'self' with no exceptions, which is where
        // the real risk lives — and why the prerendered state travels as a
        // JSON block rather than an inline script.
        styleSrc: ["'self'", "'unsafe-inline'"],
        scriptSrc: ["'self'"],
        connectSrc: ["'self'"],
        frameAncestors: ["'none'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  });
}

/** Generous — this is a club site, and a family sharing an IP is normal. */
export const apiRateLimiter = rateLimit({
  windowMs: 60_000,
  limit: 240,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "That's a lot of requests. Please wait a minute and try again." },
});

/**
 * Much tighter, and the reason the contact form is usable at all: the
 * league's own feedback form had to be switched off because spam made it
 * unusable. Five submissions an hour per address is far more than any real
 * enquirer needs.
 */
export const enquiryRateLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 5,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    message:
      "You've sent us several messages already. Please give us a chance to reply before sending another.",
  },
});

/**
 * Guards every endpoint that writes a result.
 *
 * A shared secret rather than accounts, matching what the league's own
 * site does for captains, and deliberately modest about it: this proves
 * the caller holds the secret and nothing more. See `env.ADMIN_TOKEN`.
 *
 * `timingSafeEqual` because a plain `!==` leaks the secret a byte at a
 * time to anyone patient enough to measure, and the whole security of
 * this endpoint is that one string.
 */
export function requireAdmin(): RequestHandler {
  return (req, res, next) => {
    void (async () => {
      if (!env.ADMIN_TOKEN) {
        res.status(503).json({
          message: "Result entry is not configured on this deployment (no ADMIN_TOKEN is set).",
        });
        return;
      }

      const offered = req.get("x-admin-token") ?? "";
      const expected = env.ADMIN_TOKEN;
      const a = Buffer.from(offered);
      const b = Buffer.from(expected);
      // Compare equal-length buffers so the comparison itself cannot leak
      // the length; a mismatched length is simply not the secret.
      const ok = a.length === b.length && timingSafeEqual(a, b);
      if (!ok) {
        res.status(401).json({ message: "That password was not right." });
        return;
      }

      /*
       * Who, as well as whether.
       *
       * The password is the gate and remains the gate. This is not a second
       * one: anybody holding the shared password could type anybody's
       * address, and pretending otherwise would be worse than not doing it.
       * What it buys is real all the same — every saved card carries a name,
       * and a captain who stands down can be turned off on their own record
       * without changing the password every other captain is using.
       *
       * While nobody at all is ticked the password alone still works.
       * The alternative is that deploying this locks every captain out of a
       * volunteer-run site until somebody finds the right box in Directus,
       * which is how a good idea gets reverted in a hurry. The first tick
       * closes it, and the screen says which state it is in rather than
       * leaving the committee to guess.
       */
      const email = (req.get("x-admin-email") ?? "").trim();
      const entrants = await storage.countResultEntrants();

      if (entrants === 0) {
        res.locals.entrant = { id: null, name: null, email: email || null };
        next();
        return;
      }

      if (!email) {
        res.status(401).json({
          message: "Please give the email address the committee holds for you.",
        });
        return;
      }

      const entrant = await storage.findResultEntrant(email);
      if (!entrant) {
        /*
         * Deliberately the same answer for "not on the list", "not a member"
         * and "on two records": behind the password this is not much of a
         * secret, but an endpoint that distinguishes them is still an
         * endpoint that tells you which addresses the league holds.
         */
        res.status(403).json({
          message:
            "That email address is not set up to enter results. Ask the match secretary to add it to your record.",
        });
        return;
      }

      res.locals.entrant = { id: entrant.id, name: entrant.name, email };
      next();
    })().catch(next);
  };
}

/** Who the current request says it is, as `requireAdmin` established it. */
export interface Entrant {
  id: string | null;
  name: string | null;
  email: string | null;
}

export function entrantOf(res: { locals: Record<string, unknown> }): Entrant {
  return (res.locals.entrant as Entrant | undefined) ?? { id: null, name: null, email: null };
}

/** Result entry is a handful of people a week, not a public form. */
export const adminRateLimiter = rateLimit({
  windowMs: 60 * 60_000,
  limit: 60,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please wait a while and try again." },
});

/**
 * Guards the two endpoints that are called by machines rather than people
 * — the Directus rebuild webhook and the scheduled league sync.
 */
export function requireWebhookSecret(): RequestHandler {
  return (req, res, next) => {
    if (!env.WEBHOOK_SECRET) {
      res.status(503).json({ message: "This endpoint is not configured." });
      return;
    }
    if (req.get("x-webhook-secret") !== env.WEBHOOK_SECRET) {
      res.status(401).json({ message: "Not authorised." });
      return;
    }
    next();
  };
}
