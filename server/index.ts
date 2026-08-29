import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";
import { createApp } from "./app.js";
import { env } from "./lib/env.js";
// Relative, never through the `@shared` alias — see the note in storage.ts.
import { isKnownRoute } from "../shared/routes.js";

const dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * The long-running entrypoint — `npm run dev` and any host that runs
 * `npm start`. In production it also serves the built client, so the whole
 * site is one process; on Vercel that job belongs to the CDN instead and
 * only `api/index.ts` runs.
 */
async function main(): Promise<void> {
  const app = createApp();

  if (env.isProduction) {
    const publicDir = path.resolve(dirname, "public");

    // `redirect: false` stops serve-static bouncing `/play` to `/play/`.
    // The prerendered pages live at `<route>/index.html`, and a 301 to a
    // trailing slash on every one of them would make the canonical URL of
    // every page on the site differ from the one in the navigation.
    app.use(express.static(publicDir, { redirect: false }));

    app.get("*", (req, res) => {
      // Serve the prerendered copy of this route if the build made one, so
      // the page arrives as readable HTML rather than an empty shell. Only
      // paths made of plain URL segments are considered, so a crafted path
      // cannot reach outside the build directory.
      const route = req.path.replace(/^\/+|\/+$/g, "");
      if (route && /^[a-z0-9\-/]+$/i.test(route) && !route.includes("..")) {
        const prerendered = path.join(publicDir, route, "index.html");
        if (existsSync(prerendered)) {
          res.sendFile(prerendered);
          return;
        }
      }

      // A route the app knows but the build did not prerender — a match
      // scorecard, say — is handled by the app shell, client-side.
      if (isKnownRoute(req.path)) {
        res.sendFile(path.join(publicDir, "index.html"));
        return;
      }

      /*
       * Anything else is a dead link, and is answered as one.
       *
       * Serving the app shell here meant serving the *home page's*
       * prerendered markup with a 200: the reader saw the home page for a
       * moment before React discovered the mismatch, discarded the
       * server's HTML and rendered the 404 itself, and a crawler was told
       * the missing page was fine.
       */
      const notFound = path.join(publicDir, "404.html");
      res.status(404).sendFile(existsSync(notFound) ? notFound : path.join(publicDir, "index.html"));
    });
  }

  app.listen(env.PORT, () => {
    console.log(`HRC Club server listening on http://localhost:${env.PORT}`);
    if (!env.isProduction) {
      console.log("Run `npx vite` in another terminal for the client with hot reload.");
    }
  });
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
