/**
 * The first path segment of every route the app knows how to render.
 *
 * This exists for one decision the server has to make and the client does
 * not: whether an unmatched URL is a page the single-page app will render
 * once it boots (a match scorecard, a player it has not prerendered) or a
 * dead link that deserves a 404.
 *
 * Without it the server answered both the same way — with the home page's
 * prerendered HTML and a 200. A reader following a stale link saw the home
 * page flash up and then get replaced, because React found the markup did
 * not match what it was about to render; a crawler was simply told the
 * dead URL was a good page.
 *
 * `nav.test.ts` checks this list against the site map, so a new section in
 * the menu cannot quietly start 404ing.
 */
export const KNOWN_ROUTE_SEGMENTS: readonly string[] = [
  "about",
  "admin",
  "accessibility",
  "averages",
  "clubs",
  "committee",
  "contact",
  "cups",
  "documents",
  "events",
  "fixtures",
  "gallery",
  "handicaps",
  "help",
  "honours",
  "links",
  "news",
  "newsletters",
  "play",
  "players",
  "privacy",
  "results",
  "safeguarding",
  "tables",
  "teams",
  "venues",
];

/** Is this path one the app has a route for? */
export function isKnownRoute(pathname: string): boolean {
  if (pathname === "/" || pathname === "") return true;
  const [first] = pathname.replace(/^\/+/, "").split("/");
  return first !== undefined && KNOWN_ROUTE_SEGMENTS.includes(first);
}
