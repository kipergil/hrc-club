import { createApp } from "../server/app.js";

/**
 * Vercel serverless entrypoint. Express apps are request handlers, so the
 * app object is exported directly — no `.listen()`, and one process per
 * invocation. `vercel.json` rewrites `/api/*` here; everything else is a
 * static file from the build.
 */
export default createApp();
