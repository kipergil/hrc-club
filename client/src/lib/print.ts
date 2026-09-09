/**
 * Which pages are worth printing.
 *
 * Print is a real output here: a fixture list on the hall noticeboard is
 * read by more people in a season than the page it came from, and the
 * venue list is a useful thing to have in the car. But it is not worth
 * offering on the contact form or the result-entry screen, so the button
 * has to know where it is.
 *
 * A list rather than a prop each page passes, because the button now lives
 * in the footer navigation — which `Layout` renders, not the page. A prop
 * would have to be threaded through a context and set from an effect, and
 * an effect does not run in the prerenderer: the button would be missing
 * from all 250 prerendered pages and appear a moment after hydration.
 *
 * The set is exactly the pages that carried a print button before it
 * moved. `nav.test.ts` checks every path here against the router, so a
 * renamed route cannot leave a dead entry behind.
 */

/** Pages that print as they are. */
export const PRINTABLE_PAGES: readonly string[] = [
  "/fixtures",
  "/fixtures/calendar",
  "/results",
  "/tables",
  "/averages",
  "/clubs",
  "/venues",
  "/honours",
];

/**
 * Detail pages that print: one club's details, one team's fixtures.
 *
 * Prefixes rather than exact paths because the slug is the page — there is
 * one of these per club and per team, and listing them would be a list
 * that goes stale the first time a club joins the league.
 */
export const PRINTABLE_SECTIONS: readonly string[] = ["/clubs/", "/teams/"];

export function isPrintable(pathname: string): boolean {
  // "/tables/" and "/tables" are the same page; only one of them would
  // otherwise offer the button.
  const path = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  if (PRINTABLE_PAGES.includes(path)) return true;
  // `length >` rather than `startsWith` alone: "/clubs/" with nothing after
  // it is the club list, which is already named above.
  return PRINTABLE_SECTIONS.some(
    (section) => path.startsWith(section) && path.length > section.length,
  );
}
