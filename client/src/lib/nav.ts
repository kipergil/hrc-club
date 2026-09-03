/**
 * The whole site map, in one place.
 *
 * Two rules from the league PRD are encoded here rather than left to
 * whoever adds the next page:
 *
 *  - **Five top-level entries, no more.** The array below is typed as a
 *    five-tuple, so a sixth is a compile error rather than a slow drift
 *    back to the twenty-item menu this replaces.
 *  - **Every page keeps its name and gains a subtitle.** `title` is what
 *    players already call the page; `subtitle` is the plain-English line
 *    that sits beneath it. An addition, never a replacement.
 */

export interface NavLink {
  href: string;
  title: string;
  subtitle: string;
}

export interface NavGroup {
  label: string;
  href: string;
  links: NavLink[];
}

export const NAV: readonly [NavGroup, NavGroup, NavGroup, NavGroup, NavGroup] = [
  {
    label: "Home",
    href: "/",
    links: [{ href: "/", title: "Home", subtitle: "The league at a glance" }],
  },
  {
    label: "Fixtures",
    href: "/fixtures",
    links: [
      { href: "/fixtures", title: "Fixture calendar", subtitle: "Every match still to play" },
      {
        href: "/fixtures/calendar",
        title: "Season calendar",
        subtitle: "Every team's whole season on one grid",
      },
      { href: "/results", title: "Match history", subtitle: "Every match played this season" },
      { href: "/cups", title: "Cup news", subtitle: "The four cups and how they stand" },
    ],
  },
  {
    label: "Tables",
    href: "/tables",
    links: [
      { href: "/tables", title: "League tables", subtitle: "Who is top of each division" },
      { href: "/averages", title: "Averages", subtitle: "Who has won what, this season" },
      { href: "/handicaps", title: "Handicaps", subtitle: "This season's handicap ratings" },
    ],
  },
  {
    label: "Clubs",
    href: "/clubs",
    links: [
      { href: "/clubs", title: "Club details", subtitle: "All ten clubs, their halls and their teams" },
      { href: "/venues", title: "Venues", subtitle: "Every hall on one map" },
      { href: "/teams", title: "Teams", subtitle: "Every team in the league, by division" },
      { href: "/players", title: "Players", subtitle: "Everyone registered this season" },
    ],
  },
  {
    label: "More",
    href: "/news",
    links: [
      { href: "/news", title: "Special notices", subtitle: "Announcements from the committee" },
      { href: "/newsletters", title: "Newsletters", subtitle: "Every newsletter the league has sent" },
      { href: "/honours", title: "Roll of honour", subtitle: "Champions and cup winners, back to 1950" },
      { href: "/documents", title: "Forms and documents", subtitle: "Constitution, handbook, scorecards and forms" },
      { href: "/committee", title: "Committee", subtitle: "Who runs the league, and who to ask" },
      { href: "/about", title: "About the league", subtitle: "Formed in 1936, and what that means now" },
      { href: "/links", title: "Our links", subtitle: "Table Tennis England, coaching and suppliers" },
      { href: "/help", title: "How do I…?", subtitle: "Answers to the questions we're asked most" },
      { href: "/contact", title: "Leave feedback", subtitle: "Send the committee a message" },
    ],
  },
] as const;

/** Every link on the site, flattened — used for breadcrumbs and the footer sitemap. */
export const ALL_LINKS: NavLink[] = NAV.flatMap((group) => group.links);

export function findLink(pathname: string): NavLink | undefined {
  return ALL_LINKS.find((link) => link.href === pathname);
}

/** Is `pathname` this link's page, or something filed under it? */
function isUnder(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  // The trailing slash matters: without it "/news" claims "/newsletters",
  // and a newsletter's breadcrumb trail says it is a special notice.
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * The menu entry a page belongs under — the deepest one that matches.
 *
 * `findLink` only ever matched a page exactly, so every detail page fell
 * through it: `/teams/water-lane-c` had no entry, and its trail read "Home
 * › Clubs" with neither the section it sits in nor the team it is about.
 * Depth-first because `/about/history` belongs under `/about`, and if
 * both were ever in the menu the more specific one is the right answer.
 */
export function findSection(pathname: string): NavLink | undefined {
  return ALL_LINKS.filter((link) => link.href !== "/" && isUnder(pathname, link.href)).sort(
    (a, b) => b.href.length - a.href.length,
  )[0];
}

export function findGroup(pathname: string): NavGroup | undefined {
  if (pathname === "/") return NAV[0];
  return NAV.find((group) => group.links.some((link) => isUnder(pathname, link.href)));
}
