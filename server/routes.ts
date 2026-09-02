import type { Express } from "express";
import { enquiryInputSchema, saveScorecardSchema } from "../shared/schema.js";
import { env } from "./lib/env.js";
import { CACHE, cache, handler, notFound, ok, param } from "./lib/http.js";
import {
  adminRateLimiter,
  enquiryRateLimiter,
  requireAdmin,
  requireWebhookSecret,
} from "./lib/security.js";
import { ScorecardAiUnavailable, aiConfigured, parseScorecardImage } from "./lib/scorecard-ai.js";
import { buildDraft } from "./lib/scorecard-draft.js";
import * as storage from "./storage.js";

export function registerRoutes(app: Express): void {
  // -- Site-wide -----------------------------------------------------------

  app.get(
    "/api/settings",
    handler(async (_req, res) => {
      ok(res, await storage.getSettings());
    }),
  );

  app.get(
    "/api/home",
    handler(async (_req, res) => {
      ok(res, await storage.getHome());
    }),
  );

  app.get(
    "/api/seasons",
    handler(async (_req, res) => {
      ok(res, await storage.getSeasons(), CACHE.static);
    }),
  );

  // -- Static content ------------------------------------------------------

  app.get(
    "/api/pages",
    handler(async (_req, res) => {
      ok(res, await storage.getPages(), CACHE.static);
    }),
  );

  app.get(
    "/api/pages/:slug",
    handler(async (req, res) => {
      const page = await storage.getPage(req.params.slug);
      if (!page) return notFound(res, "page");
      ok(res, page, CACHE.static);
    }),
  );

  app.get(
    "/api/sessions",
    handler(async (_req, res) => {
      ok(res, await storage.getSessions(), CACHE.static);
    }),
  );

  app.get(
    "/api/venues",
    handler(async (_req, res) => {
      ok(res, await storage.getVenues(), CACHE.static);
    }),
  );

  app.get(
    "/api/venues/:slug",
    handler(async (req, res) => {
      const venue = await storage.getVenue(req.params.slug);
      if (!venue) return notFound(res, "venue");
      ok(res, venue, CACHE.static);
    }),
  );


  app.get(
    "/api/committee",
    handler(async (_req, res) => {
      ok(res, await storage.getCommitteeRoles(), CACHE.static);
    }),
  );

  app.get(
    "/api/documents",
    handler(async (_req, res) => {
      ok(res, await storage.getDocuments(), CACHE.static);
    }),
  );


  app.get(
    "/api/links",
    handler(async (_req, res) => {
      ok(res, await storage.getLinks(), CACHE.static);
    }),
  );

  app.get(
    "/api/faqs",
    handler(async (_req, res) => {
      ok(res, await storage.getFaqs(), CACHE.static);
    }),
  );

  app.get(
    "/api/honours",
    handler(async (_req, res) => {
      ok(res, await storage.getHonours(), CACHE.static);
    }),
  );

  // -- Clubs ---------------------------------------------------------------

  app.get(
    "/api/clubs",
    handler(async (_req, res) => {
      ok(res, await storage.getClubs(), CACHE.slow);
    }),
  );

  app.get(
    "/api/clubs/:slug",
    handler(async (req, res) => {
      const club = await storage.getClub(req.params.slug);
      if (!club) return notFound(res, "club");
      ok(res, club, CACHE.slow);
    }),
  );

  // -- Teams, fixtures, results, tables ------------------------------------

  app.get(
    "/api/teams",
    handler(async (req, res) => {
      ok(res, await storage.getTeams(param(req.query.season), param(req.query.club)), CACHE.slow);
    }),
  );

  app.get(
    "/api/teams/:slug",
    handler(async (req, res) => {
      const team = await storage.getTeam(req.params.slug, param(req.query.season));
      if (!team) return notFound(res, "team");
      ok(res, team);
    }),
  );

  app.get(
    "/api/fixtures",
    handler(async (req, res) => {
      const fixtures = await storage.getFixtures({
        season: param(req.query.season),
        team: param(req.query.team),
        division: param(req.query.division),
        status: param(req.query.status),
        competition: param(req.query.competition),
        limit: param(req.query.limit) ? Number(req.query.limit) : undefined,
      });
      ok(res, fixtures);
    }),
  );

  app.get(
    "/api/fixtures/:id",
    handler(async (req, res) => {
      const fixture = await storage.getFixture(req.params.id);
      if (!fixture) return notFound(res, "match");
      ok(res, fixture, CACHE.slow);
    }),
  );

  app.get(
    "/api/standings",
    handler(async (req, res) => {
      ok(res, await storage.getStandings(param(req.query.season), param(req.query.division)));
    }),
  );

  app.get(
    "/api/averages",
    handler(async (req, res) => {
      ok(res, await storage.getPlayerStats(param(req.query.season)));
    }),
  );

  // -- People --------------------------------------------------------------

  app.get(
    "/api/players",
    handler(async (_req, res) => {
      ok(res, await storage.getMembers(), CACHE.slow);
    }),
  );

  app.get(
    "/api/players/:slug",
    handler(async (req, res) => {
      const member = await storage.getMember(req.params.slug);
      if (!member) return notFound(res, "player");
      ok(res, member, CACHE.slow);
    }),
  );

  // -- News, events, gallery -----------------------------------------------

  app.get(
    "/api/news",
    handler(async (req, res) => {
      const limit = param(req.query.limit) ? Number(req.query.limit) : undefined;
      ok(res, await storage.getNews(param(req.query.category), limit));
    }),
  );

  app.get(
    "/api/news/:slug",
    handler(async (req, res) => {
      const item = await storage.getNewsItem(req.params.slug);
      if (!item) return notFound(res, "article");
      ok(res, item);
    }),
  );

  app.get(
    "/api/events",
    handler(async (req, res) => {
      ok(res, await storage.getEvents(param(req.query.past) === "true"));
    }),
  );

  app.get(
    "/api/events/:slug",
    handler(async (req, res) => {
      const event = await storage.getEvent(req.params.slug);
      if (!event) return notFound(res, "event");
      ok(res, event);
    }),
  );

  app.get(
    "/api/gallery",
    handler(async (_req, res) => {
      ok(res, await storage.getGalleryAlbums(), CACHE.slow);
    }),
  );

  app.get(
    "/api/gallery/:slug",
    handler(async (req, res) => {
      const album = await storage.getGalleryAlbum(req.params.slug);
      if (!album) return notFound(res, "album");
      ok(res, album, CACHE.slow);
    }),
  );

  // -- Files ---------------------------------------------------------------

  /**
   * Assets are proxied rather than linked directly at the Directus host.
   * Three reasons, in order of how much they matter: the Content-Security-
   * Policy stays `'self'`; the Directus URL never appears in page source,
   * so moving instances breaks no published link; and the service token
   * stays server-side, which a direct <img src> to a private asset could
   * not manage.
   */
  app.get(
    "/api/files/:id",
    handler(async (req, res) => {
      const query = new URLSearchParams();
      for (const key of ["width", "height", "fit", "quality", "format"]) {
        const value = param(req.query[key]);
        if (value) query.set(key, value);
      }
      const suffix = query.size > 0 ? `?${query.toString()}` : "";
      const url = `${env.DIRECTUS_URL}/assets/${encodeURIComponent(req.params.id)}${suffix}`;

      const upstream = await fetch(url, {
        headers: env.DIRECTUS_SERVICE_TOKEN
          ? { Authorization: `Bearer ${env.DIRECTUS_SERVICE_TOKEN}` }
          : {},
      });

      if (!upstream.ok || !upstream.body) {
        return notFound(res, "file");
      }

      cache(res, CACHE.static);
      const contentType = upstream.headers.get("content-type");
      if (contentType) res.setHeader("Content-Type", contentType);
      const disposition = upstream.headers.get("content-disposition");
      if (disposition) res.setHeader("Content-Disposition", disposition);

      res.send(Buffer.from(await upstream.arrayBuffer()));
    }),
  );

  // -- Enquiries -----------------------------------------------------------

  app.post(
    "/api/enquiries",
    enquiryRateLimiter,
    handler(async (req, res) => {
      const parsed = enquiryInputSchema.safeParse(req.body);
      if (!parsed.success) {
        cache(res, CACHE.none);
        // Keyed by field so the form can put each message next to the input
        // it belongs to, which is what the PRD's §7.4 requires.
        const errors: Record<string, string> = {};
        for (const issue of parsed.error.issues) {
          const field = issue.path[0];
          if (typeof field === "string" && !errors[field]) errors[field] = issue.message;
        }
        res.status(400).json({ message: "Please check the highlighted answers.", errors });
        return;
      }

      // The honeypot. Answer exactly as if it had worked: a bot that gets a
      // 400 learns to try again, one that gets a 200 does not.
      if (parsed.data.website) {
        cache(res, CACHE.none);
        res.json({ data: { received: true } });
        return;
      }

      await storage.createEnquiry(parsed.data);
      cache(res, CACHE.none);
      res.json({ data: { received: true } });
    }),
  );

  // -- Scorecards ----------------------------------------------------------

  /*
   * Everything under /api/admin writes results, so everything under it is
   * behind the same gate. Grouped rather than gated one route at a time,
   * because a route added later without the middleware is a hole nobody
   * would notice.
   */

  /** Whether this deployment can read cards at all, so the UI can say so up front. */
  app.get(
    "/api/admin/scorecards/capability",
    adminRateLimiter,
    requireAdmin(),
    handler(async (_req, res) => {
      cache(res, CACHE.none);
      ok(res, { ai: aiConfigured() });
    }),
  );

  /** The empty card for a fixture: both squads, ten blank rubbers. */
  app.get(
    "/api/admin/scorecards/blank/:fixtureId",
    adminRateLimiter,
    requireAdmin(),
    handler(async (req, res) => {
      cache(res, CACHE.none);
      const fixtureId = param(req.params.fixtureId);
      const draft = fixtureId ? await buildDraft(fixtureId, null) : null;
      if (!draft) {
        notFound(res, "fixture");
        return;
      }
      ok(res, draft);
    }),
  );

  /**
   * Reads a photographed card and returns a draft for a person to check.
   *
   * A draft, never a save. The two are separate endpoints because they
   * are separate decisions: the machine proposes, and somebody who was
   * at the match decides.
   */
  app.post(
    "/api/admin/scorecards/parse",
    adminRateLimiter,
    requireAdmin(),
    handler(async (req, res) => {
      cache(res, CACHE.none);

      const { fixtureId, image, mediaType } = req.body ?? {};
      if (typeof fixtureId !== "string" || typeof image !== "string" || !image) {
        res.status(400).json({ message: "Pick a match and choose a photograph of the card." });
        return;
      }
      if (typeof mediaType !== "string" || !/^image\/(png|jpeg|webp|gif)$/.test(mediaType)) {
        res.status(400).json({ message: "That file is not a PNG, JPEG, WebP or GIF image." });
        return;
      }

      const context = await storage.getFixtureSquads(fixtureId);
      if (!context.fixture) {
        notFound(res, "fixture");
        return;
      }

      /*
       * Refused before anything is stored. This used to sit after the
       * upload, so a deployment with no API key filed a fresh orphaned
       * image in Directus every time somebody pressed the button — a
       * slow leak nothing would ever have reported.
       */
      if (!aiConfigured()) {
        res.status(503).json({
          message:
            "No Anthropic API key is configured, so cards cannot be read automatically. You can still enter this one by hand.",
        });
        return;
      }

      /*
       * Filed before it is read, not after. A card the model then fails
       * on is exactly the one worth looking at later, and storing only
       * the successes would keep the evidence for the cases that need it
       * least.
       */
      const imageId = await storage.storeScorecardImage({
        data: image,
        mediaType,
        filename: `card-${context.fixture.homeTeam.slug || "home"}-v-${context.fixture.awayTeam.slug || "away"}.${mediaType.split("/")[1]}`,
      });

      try {
        const parsed = await parseScorecardImage(
          { data: image, mediaType },
          {
            homeTeamName: context.fixture.homeTeam.name,
            awayTeamName: context.fixture.awayTeam.name,
            homeSquad: context.homeSquad.map((member) => member.fullName),
            awaySquad: context.awaySquad.map((member) => member.fullName),
          },
        );

        const draft = await buildDraft(fixtureId, parsed.card);
        if (!draft) {
          notFound(res, "fixture");
          return;
        }

        // Recorded whether or not it is ever saved, so a bad parse can be
        // looked at afterwards rather than only complained about.
        await storage.recordScorecardUpload({
          fixtureId,
          imageId,
          status: "parsed",
          parsed: parsed.card,
          warnings: draft.warnings,
          model: parsed.model,
          inputTokens: parsed.inputTokens,
          outputTokens: parsed.outputTokens,
        });

        ok(res, draft);
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "The card could not be read.";

        /*
         * The image is filed either way. It has already been uploaded by
         * this point, so returning without recording it would leave an
         * unreferenced file in Directus on every attempt — the same slow
         * leak the no-key check above was moved to prevent, reappearing
         * the first time a key turned out to be misconfigured.
         */
        await storage.recordScorecardUpload({ fixtureId, imageId, status: "failed", error: message });

        if (error instanceof ScorecardAiUnavailable) {
          /*
           * Not the card's fault: no key, a key the API rejects, a
           * workspace it will not infer, an outage. 503 rather than 422
           * because nothing about the photograph would change the
           * outcome, and the message says so — a captain sent looking for
           * a clearer photograph of a perfectly good card is a captain
           * who stops using this.
           */
          res.status(503).json({ message });
          return;
        }
        res.status(422).json({ message });
      }
    }),
  );

  /** Saves a checked card onto its fixture. */
  app.post(
    "/api/admin/scorecards",
    adminRateLimiter,
    requireAdmin(),
    handler(async (req, res) => {
      cache(res, CACHE.none);

      const parsed = saveScorecardSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
          message: "That card could not be saved.",
          errors: parsed.error.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        });
        return;
      }

      const saved = await storage.saveScorecard({
        fixtureId: parsed.data.fixtureId,
        playedOn: parsed.data.playedOn ?? null,
        rubbers: parsed.data.rubbers,
      });
      ok(res, saved);
    }),
  );

  // -- Machine endpoints ---------------------------------------------------

  /**
   * Called by a Directus Flow when content changes. Triggers a Vercel
   * rebuild so the prerendered copy catches up with what the CDN-cached API
   * is already serving.
   */
  app.post(
    "/api/revalidate",
    requireWebhookSecret(),
    handler(async (_req, res) => {
      cache(res, CACHE.none);
      if (!env.VERCEL_DEPLOY_HOOK_URL) {
        res.json({ data: { triggered: false, reason: "No deploy hook configured." } });
        return;
      }
      const response = await fetch(env.VERCEL_DEPLOY_HOOK_URL, { method: "POST" });
      res.json({ data: { triggered: response.ok } });
    }),
  );

  app.get("/api/health", (_req, res) => {
    cache(res, CACHE.none);
    res.json({ data: { ok: true } });
  });
}
