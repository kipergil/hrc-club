import type { FixtureStatus } from "@shared/enums.js";

/**
 * Where a team's name should take you.
 *
 * The rule is: **a team name links within the module you are already in.**
 * From a result, to that team's results; from a fixture, to that team's
 * fixtures; from a season calendar, to that team's fixtures. Only where
 * there is no module to stay in — a table row, a squad list, a venue's
 * tenants — does it go to the team's own page.
 *
 * The old behaviour sent every team name to `/teams/:slug` regardless. That
 * is the team's whole season with a squad, a captain and a venue above it,
 * so somebody who clicked a name in a results list to see "how have they
 * done" landed at the top of a page and had to scroll past three cards to
 * find out. Worse, it silently changed what they were doing: they were
 * reading results and ended up in the teams section.
 *
 * The league's own site sets the precedent this follows — its tables page
 * says "Click on your Team Name in the relevant table below to see all your
 * team's League Matches for the season", which is a link into the matches,
 * not into a profile.
 */
export function teamModuleHref(
  slug: string,
  status: FixtureStatus,
  season?: string,
): string {
  // A played match belongs to the results module; anything else is still a
  // fixture. Deriving it from the row rather than from the page means a
  // mixed list — a club page showing both — links each row correctly.
  const base = status === "played" ? "/results" : "/fixtures";
  const params = new URLSearchParams({ team: slug });
  if (season) params.set("season", season);
  return `${base}?${params.toString()}`;
}

/** That team's remaining fixtures. Used where a view is about the calendar. */
export function teamFixturesHref(slug: string, season?: string): string {
  return teamModuleHref(slug, "scheduled", season);
}

/** The team's own page: squad, captain, home night, and its whole season. */
export function teamHref(slug: string, season?: string): string {
  return season ? `/teams/${slug}?season=${encodeURIComponent(season)}` : `/teams/${slug}`;
}
