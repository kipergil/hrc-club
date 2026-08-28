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
    links: [{ href: "/", title: "Home", subtitle: "Everything at a glance" }],
  },
  {
    label: "Play",
    href: "/play",
    links: [
      { href: "/play", title: "When we play", subtitle: "Club nights, times and what it costs" },
      { href: "/join", title: "Join us", subtitle: "Membership, fees and how to start" },
      { href: "/coaching", title: "Coaching", subtitle: "Lessons and practice sessions" },
      { href: "/juniors", title: "Juniors", subtitle: "Table tennis for under-18s" },
    ],
  },
  {
    label: "Teams",
    href: "/teams",
    links: [
      { href: "/teams", title: "Our teams", subtitle: "HRC A, B and C, and who plays for them" },
      { href: "/fixtures", title: "Fixture calendar", subtitle: "Every match still to play" },
      { href: "/results", title: "Match history", subtitle: "Every match our teams have played" },
      { href: "/tables", title: "League tables", subtitle: "Where our three teams stand" },
      { href: "/averages", title: "Averages", subtitle: "Who has won what, this season" },
      { href: "/handicaps", title: "Handicaps", subtitle: "This season's handicap ratings" },
      { href: "/cups", title: "Cup matches", subtitle: "The four cups and how we're doing" },
      { href: "/players", title: "Players", subtitle: "Everyone who turns out for the club" },
    ],
  },
  {
    label: "News",
    href: "/news",
    links: [
      { href: "/news", title: "News and notices", subtitle: "What's happening at the club" },
      { href: "/events", title: "What's on", subtitle: "AGM, presentation night and socials" },
      { href: "/newsletters", title: "Newsletters", subtitle: "Every newsletter we've sent" },
      { href: "/gallery", title: "Photos", subtitle: "Match nights, finals and presentation evenings" },
    ],
  },
  {
    label: "About",
    href: "/about",
    links: [
      { href: "/about", title: "About the club", subtitle: "Who we are and where we came from" },
      { href: "/about/history", title: "Our history", subtitle: "The club through the years" },
      { href: "/committee", title: "Who's who", subtitle: "The committee, and who to ask about what" },
      { href: "/honours", title: "Roll of honour", subtitle: "Every title and trophy we've won" },
      { href: "/documents", title: "Club documents", subtitle: "Constitution, minutes and forms" },
      { href: "/links", title: "Useful links", subtitle: "The league, the county and beyond" },
      { href: "/sponsors", title: "Sponsors", subtitle: "The people who help us keep going" },
      { href: "/help", title: "How do I…?", subtitle: "Answers to the questions we're asked most" },
      { href: "/contact", title: "Contact us", subtitle: "Send us a message" },
    ],
  },
] as const;

/** Every link on the site, flattened — used for breadcrumbs and the footer sitemap. */
export const ALL_LINKS: NavLink[] = NAV.flatMap((group) => group.links);

export function findLink(pathname: string): NavLink | undefined {
  return ALL_LINKS.find((link) => link.href === pathname);
}

export function findGroup(pathname: string): NavGroup | undefined {
  if (pathname === "/") return NAV[0];
  return NAV.find((group) =>
    group.links.some((link) => link.href !== "/" && pathname.startsWith(link.href)),
  );
}
