import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { QueryClient, QueryClientProvider, dehydrate } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { Router } from "wouter";
import App from "../client/src/App";
import { keys } from "../client/src/lib/queries";
import * as storage from "../server/storage";

/**
 * The build step that makes this site work without JavaScript.
 *
 * Vite alone produces a single empty `index.html` and a bundle — which is
 * fine for an app behind a login, and wrong for a club site whose readers
 * include people on old phones and slow connections, and whose most-visited
 * page has to answer "when do you play" before anything has finished
 * downloading.
 *
 * So every Tier A and Tier B route is rendered here, at build time, into
 * real HTML with its data already in the markup. The dehydrated query cache
 * rides along in a script tag, so the client hydrates without re-fetching
 * what the reader can already see.
 *
 * Data comes straight from `server/storage.ts` rather than over HTTP: there
 * is no server running during a build, and the storage layer is the same
 * code the API routes call anyway.
 */

const OUT_DIR = path.resolve(import.meta.dirname, "../dist/public");

interface RouteSpec {
  path: string;
  /** Populates the query cache before rendering. Anything not prefetched renders as a loading state and fills in on hydration. */
  prefetch: (client: QueryClient) => Promise<void>;
}

/** Every page needs the header, footer and announcement banner. */
async function prefetchShell(client: QueryClient): Promise<void> {
  await client.prefetchQuery({ queryKey: keys.settings, queryFn: () => storage.getSettings() });
}

function route(pathname: string, prefetch?: (client: QueryClient) => Promise<void>): RouteSpec {
  return {
    path: pathname,
    prefetch: async (client) => {
      await prefetchShell(client);
      if (prefetch) await prefetch(client);
    },
  };
}

async function collectRoutes(): Promise<RouteSpec[]> {
  const routes: RouteSpec[] = [
    route("/", async (client) => {
      await client.prefetchQuery({ queryKey: keys.home, queryFn: () => storage.getHome() });
    }),

    // Tier A — editorial content.
    route("/about", async (client) => {
      await client.prefetchQuery({ queryKey: keys.page("about"), queryFn: () => storage.getPage("about") });
    }),
    route("/about/history", async (client) => {
      await client.prefetchQuery({ queryKey: keys.page("history"), queryFn: () => storage.getPage("history") });
    }),
    route("/coaching", async (client) => {
      await client.prefetchQuery({ queryKey: keys.page("coaching"), queryFn: () => storage.getPage("coaching") });
    }),
    route("/juniors", async (client) => {
      await client.prefetchQuery({ queryKey: keys.page("juniors"), queryFn: () => storage.getPage("juniors") });
    }),
    route("/privacy", async (client) => {
      await client.prefetchQuery({ queryKey: keys.page("privacy"), queryFn: () => storage.getPage("privacy") });
    }),
    route("/accessibility", async (client) => {
      await client.prefetchQuery({
        queryKey: keys.page("accessibility"),
        queryFn: () => storage.getPage("accessibility"),
      });
    }),
    route("/safeguarding", async (client) => {
      await client.prefetchQuery({
        queryKey: keys.page("safeguarding"),
        queryFn: () => storage.getPage("safeguarding"),
      });
    }),

    route("/play", async (client) => {
      await Promise.all([
        client.prefetchQuery({ queryKey: keys.sessions, queryFn: () => storage.getSessions() }),
        client.prefetchQuery({ queryKey: keys.venues, queryFn: () => storage.getVenues() }),
      ]);
    }),
    route("/join", async (client) => {
      await Promise.all([
        client.prefetchQuery({
          queryKey: keys.membershipOptions,
          queryFn: () => storage.getMembershipOptions(),
        }),
        client.prefetchQuery({ queryKey: keys.page("join"), queryFn: () => storage.getPage("join") }),
      ]);
    }),

    route("/committee", async (client) => {
      await client.prefetchQuery({ queryKey: keys.committee, queryFn: () => storage.getCommitteeRoles() });
    }),
    route("/honours", async (client) => {
      await client.prefetchQuery({ queryKey: keys.honours, queryFn: () => storage.getHonours() });
    }),
    route("/documents", async (client) => {
      await client.prefetchQuery({ queryKey: keys.documents, queryFn: () => storage.getDocuments() });
    }),
    route("/links", async (client) => {
      await client.prefetchQuery({ queryKey: keys.links, queryFn: () => storage.getLinks() });
    }),
    route("/sponsors", async (client) => {
      await client.prefetchQuery({ queryKey: keys.sponsors, queryFn: () => storage.getSponsors() });
    }),
    route("/help", async (client) => {
      await client.prefetchQuery({ queryKey: keys.faqs, queryFn: () => storage.getFaqs() });
    }),
    route("/contact"),

    // Tier B — league data and club news.
    route("/clubs", async (client) => {
      await client.prefetchQuery({ queryKey: keys.clubs, queryFn: () => storage.getClubs() });
    }),
    route("/teams", async (client) => {
      await client.prefetchQuery({ queryKey: keys.teams(), queryFn: () => storage.getTeams() });
    }),
    route("/fixtures", async (client) => {
      await client.prefetchQuery({
        queryKey: keys.fixtures("status=scheduled"),
        queryFn: () => storage.getFixtures({ status: "scheduled" }),
      });
    }),
    route("/results", async (client) => {
      await client.prefetchQuery({
        queryKey: keys.fixtures("status=played"),
        queryFn: () => storage.getFixtures({ status: "played" }),
      });
    }),
    route("/cups", async (client) => {
      await client.prefetchQuery({
        queryKey: keys.fixtures("competition=cup"),
        queryFn: () => storage.getFixtures({ competition: "cup" }),
      });
    }),
    route("/tables", async (client) => {
      await client.prefetchQuery({ queryKey: keys.standings(), queryFn: () => storage.getStandings() });
    }),
    route("/averages", async (client) => {
      await client.prefetchQuery({ queryKey: keys.averages(), queryFn: () => storage.getPlayerStats() });
    }),
    route("/handicaps", async (client) => {
      await client.prefetchQuery({ queryKey: keys.averages(), queryFn: () => storage.getPlayerStats() });
    }),
    route("/players", async (client) => {
      await client.prefetchQuery({ queryKey: keys.players, queryFn: () => storage.getMembers() });
    }),
    route("/news", async (client) => {
      await client.prefetchQuery({ queryKey: keys.news(), queryFn: () => storage.getNews() });
    }),
    route("/newsletters", async (client) => {
      await client.prefetchQuery({
        queryKey: keys.news("newsletter"),
        queryFn: () => storage.getNews("newsletter"),
      });
    }),
    route("/events", async (client) => {
      await client.prefetchQuery({ queryKey: keys.events, queryFn: () => storage.getEvents() });
    }),
    route("/gallery", async (client) => {
      await client.prefetchQuery({ queryKey: keys.gallery, queryFn: () => storage.getGalleryAlbums() });
    }),
  ];

  // Detail pages are enumerated from the data rather than listed by hand,
  // so a new article or a new team is prerendered by the next build without
  // anyone remembering to add it here.
  const [clubs, teams, players, news, events, albums, venues] = await Promise.all([
    storage.getClubs(),
    storage.getTeams(),
    storage.getMembers(),
    storage.getNews(),
    storage.getEvents(true),
    storage.getGalleryAlbums(),
    storage.getVenues(),
  ]);

  for (const club of clubs) {
    routes.push(
      route(`/clubs/${club.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.club(club.slug),
          queryFn: () => storage.getClub(club.slug),
        });
      }),
    );
  }

  for (const team of teams) {
    routes.push(
      route(`/teams/${team.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.team(team.slug),
          queryFn: () => storage.getTeam(team.slug),
        });
      }),
    );
  }

  for (const player of players) {
    routes.push(
      route(`/players/${player.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.player(player.slug),
          queryFn: () => storage.getMember(player.slug),
        });
      }),
    );
  }

  for (const item of news) {
    routes.push(
      route(`/news/${item.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.newsItem(item.slug),
          queryFn: () => storage.getNewsItem(item.slug),
        });
      }),
    );
  }

  for (const event of events) {
    routes.push(
      route(`/events/${event.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.event(event.slug),
          queryFn: () => storage.getEvent(event.slug),
        });
      }),
    );
  }

  for (const album of albums) {
    routes.push(
      route(`/gallery/${album.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.album(album.slug),
          queryFn: () => storage.getGalleryAlbum(album.slug),
        });
      }),
    );
  }

  for (const venue of venues) {
    routes.push(
      route(`/play/venue/${venue.slug}`, async (client) => {
        await client.prefetchQuery({
          queryKey: keys.venue(venue.slug),
          queryFn: () => storage.getVenue(venue.slug),
        });
      }),
    );
  }

  return routes;
}

function outputPath(routePath: string): string {
  return routePath === "/"
    ? path.join(OUT_DIR, "index.html")
    : path.join(OUT_DIR, routePath.replace(/^\//, ""), "index.html");
}

/**
 * `</script>` inside the embedded JSON would close the surrounding tag
 * early — the classic way to turn content into markup. Directus content is
 * committee-authored rather than hostile, but this is one character of
 * defence against a mistake that would otherwise break every page it
 * appeared on.
 */
function serialiseState(state: unknown): string {
  return JSON.stringify(state).replace(/</g, "\\u003c");
}

async function main(): Promise<void> {
  const template = await readFile(path.join(OUT_DIR, "index.html"), "utf8");
  if (!template.includes('<div id="root"></div>')) {
    throw new Error('Built index.html has no <div id="root"></div> to render into.');
  }

  let routes: RouteSpec[];
  try {
    routes = await collectRoutes();
  } catch (error) {
    // No reachable Directus — a CI build with no credentials, or an
    // instance that is down. The site still works: `index.html` is a
    // complete single-page app that fetches at runtime. What is lost is the
    // no-JavaScript fallback, which is worth a loud warning and not worth
    // failing a deploy over.
    console.warn(
      `\n  ! Could not reach Directus (${(error as Error).message}).\n` +
        "  ! Skipping prerender — the built site will be client-rendered only.\n",
    );
    return;
  }

  console.log(`Prerendering ${routes.length} routes...`);

  let rendered = 0;
  for (const spec of routes) {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: Infinity } },
    });

    try {
      await spec.prefetch(queryClient);

      // `ssrPath` is wouter's own server-rendering entry point. A memory
      // location hook looks equivalent but is not: it drives routing through
      // `useSyncExternalStore`, which has no server snapshot and makes React
      // silently fall back to client rendering — producing an empty shell
      // that looks like a successful prerender.
      const html = renderToString(
        <QueryClientProvider client={queryClient}>
          <Router ssrPath={spec.path}>
            <App />
          </Router>
        </QueryClientProvider>,
      );

      const state = serialiseState(dehydrate(queryClient));
      // A `type="application/json"` block, not an inline script: the site
      // is served with `script-src 'self'`, which drops an inline script
      // without a word — and a dropped state script means every
      // prerendered page snaps back to a loading spinner on hydration.
      // JSON is data, so the policy leaves it alone.
      const page = template.replace(
        '<div id="root"></div>',
        `<div id="root">${html}</div>\n    <script type="application/json" id="hrc-state">${state}</script>`,
      );

      const file = outputPath(spec.path);
      await mkdir(path.dirname(file), { recursive: true });
      await writeFile(file, page, "utf8");
      rendered += 1;
    } catch (error) {
      // One bad route must not fail the whole build: the SPA still serves
      // that path correctly, it just does not get a prerendered copy. A
      // loud warning is the right level — worth fixing, not worth blocking
      // a deploy for.
      console.warn(`  ! ${spec.path} — ${(error as Error).message}`);
    } finally {
      queryClient.clear();
    }
  }

  console.log(`Prerendered ${rendered}/${routes.length} routes into dist/public.`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  // The Directus SDK's session client keeps a token-refresh timer running,
  // which would otherwise hold the build open long after the last page is
  // written.
  .finally(() => process.exit(process.exitCode ?? 0));
