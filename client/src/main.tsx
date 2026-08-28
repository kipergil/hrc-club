import { HydrationBoundary, QueryClientProvider, type DehydratedState } from "@tanstack/react-query";
import { StrictMode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import App from "./App";
import { createQueryClient } from "./lib/queries";
import "./index.css";

/**
 * Reads the query cache the prerenderer embedded alongside the markup.
 *
 * It arrives as a `type="application/json"` block rather than an inline
 * script, because the site is served with `script-src 'self'` and an
 * inline script is dropped silently — taking the page's data with it and
 * leaving a prerendered page to blank back to a loading state the instant
 * it hydrates.
 */
function readEmbeddedState(): DehydratedState | undefined {
  const node = document.getElementById("hrc-state");
  if (!node?.textContent) return undefined;
  try {
    return JSON.parse(node.textContent) as DehydratedState;
  } catch {
    // Better to fetch everything again than to fail to render at all.
    return undefined;
  }
}

const container = document.getElementById("root");
if (!container) throw new Error("No #root element — check client/index.html.");

const queryClient = createQueryClient();
const dehydratedState = readEmbeddedState();

const tree = (
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <HydrationBoundary state={dehydratedState}>
        <App />
      </HydrationBoundary>
    </QueryClientProvider>
  </StrictMode>
);

/*
 * A prerendered page arrives as real HTML with its data already embedded,
 * so it hydrates in place — the reader sees content before any of this
 * runs, and nothing repaints when it does. Anything not prerendered (a
 * match page, a player profile) renders fresh.
 */
if (container.hasChildNodes() && dehydratedState) {
  hydrateRoot(container, tree);
} else {
  createRoot(container).render(tree);
}
