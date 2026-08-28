import rateLimit from "express-rate-limit";
import helmet from "helmet";
import type { RequestHandler } from "express";
import { env } from "./env.js";

export function securityHeaders(): RequestHandler {
  return helmet({
    // Images and documents are proxied from Directus through this same
    // origin (/api/files/:id), so the policy does not need to name the
    // Directus host at all — one fewer thing to update when it moves.
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:"],
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
