import express, { type Express, type NextFunction, type Request, type Response } from "express";
import { registerRoutes } from "./routes.js";
import { apiRateLimiter, securityHeaders } from "./lib/security.js";

/**
 * Builds the Express app with every route registered, but does not bind it
 * to a port. Shared by both entrypoints: `server/index.ts` (long-running)
 * and `api/index.ts` (one process per invocation on Vercel, no `.listen()`).
 */
export function createApp(): Express {
  const app = express();

  app.disable("x-powered-by");
  app.use(securityHeaders());
  app.use("/api", apiRateLimiter);
  /*
   * 64kb everywhere except the one route that carries a photograph.
   *
   * The general limit stays small on purpose — every public endpoint
   * takes a form's worth of text, and a large body limit on a public API
   * is an invitation. A card image is base64 in a JSON body, so it needs
   * room, and it gets it only on the route that is behind the admin gate.
   * 8mb covers a phone photograph with the headroom base64 costs (~33%);
   * bigger than that is a scan nobody needed at that size.
   */
  app.use("/api/admin/scorecards/parse", express.json({ limit: "8mb" }));
  app.use(express.json({ limit: "64kb" }));
  app.use(express.urlencoded({ extended: false }));

  registerRoutes(app);

  app.use((error: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = error?.status ?? error?.statusCode ?? 500;
    // Never leak an upstream error's text to a visitor: it is written for
    // an operator, not a person trying to find out when the club plays.
    // The detail goes to the log; the reader gets a sentence and a way out.
    if (status >= 500) {
      console.error("[error]", error);
    }
    res.setHeader("Cache-Control", "private, no-store");
    res.status(status).json({
      message:
        status >= 500
          ? "Something went wrong at our end. Please try again in a moment — if it keeps happening, do let us know."
          : (error?.message ?? "That request didn't work."),
    });
  });

  return app;
}
