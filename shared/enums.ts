/**
 * Single source of truth for every closed value set in the club site.
 *
 * Imported by the Directus schema tooling (which turns each list into a
 * `select-dropdown`'s choices) and, once the app is built, by the React
 * client and Express server. One definition means a value can never be
 * valid in the admin panel but unknown to the UI rendering it.
 *
 * Labels are separated from values deliberately: values are stable,
 * machine-readable and never shown to a visitor; labels are the
 * plain-English wording the PRD's §7.4 requires, and can be reworded
 * without a data migration.
 */

export const PAGE_STATUS = ["draft", "published", "archived"] as const;
export type PageStatus = (typeof PAGE_STATUS)[number];

/**
 * Which top-level nav entry a page hangs under. The league PRD's "new look,
 * same map" constraint caps the top nav at five entries; this is the club
 * equivalent — Home · Play · Teams · News · About — and `hidden` is for
 * pages reachable only by direct link (privacy notice, thank-you pages).
 */
export const NAV_GROUP = ["home", "play", "teams", "news", "about", "hidden"] as const;
export type NavGroup = (typeof NAV_GROUP)[number];

export const NAV_GROUP_LABELS: Record<NavGroup, string> = {
  home: "Home",
  play: "Play",
  teams: "Teams",
  news: "News",
  about: "About",
  hidden: "Not in the menu",
};

export const SESSION_TYPE = [
  "club_night",
  "junior",
  "coaching",
  "social",
  "league_match",
  "tournament",
] as const;
export type SessionType = (typeof SESSION_TYPE)[number];

export const SESSION_TYPE_LABELS: Record<SessionType, string> = {
  club_night: "Club night — turn up and play",
  junior: "Juniors",
  coaching: "Coaching",
  social: "Social",
  league_match: "League match night",
  tournament: "Tournament",
};

export const DAY_OF_WEEK = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;
export type DayOfWeek = (typeof DAY_OF_WEEK)[number];

export const MEMBER_STATUS = ["active", "lapsed", "life", "honorary"] as const;
export type MemberStatus = (typeof MEMBER_STATUS)[number];

/** The league's three divisions, as named on hertsttl.org.uk. */
export const DIVISION = ["premier", "division_1", "division_2"] as const;
export type Division = (typeof DIVISION)[number];

export const DIVISION_LABELS: Record<Division, string> = {
  premier: "Premier Division",
  division_1: "Division 1",
  division_2: "Division 2",
};

export const SQUAD_ROLE = ["captain", "vice_captain", "player", "reserve"] as const;
export type SquadRole = (typeof SQUAD_ROLE)[number];

/**
 * Competitions an HRC team or player can appear in. The four cups are the
 * league's own, named in the site audit; `closed_championship` is the
 * league's individual event.
 */
export const COMPETITION = [
  "league",
  "creasey_cup",
  "clifford_troll_trophy",
  "msd_trophy",
  "hertford_builders_trophy",
  "closed_championship",
  "club_championship",
  "friendly",
] as const;
export type Competition = (typeof COMPETITION)[number];

export const COMPETITION_LABELS: Record<Competition, string> = {
  league: "League",
  creasey_cup: "Creasey Cup",
  clifford_troll_trophy: "Clifford Troll Trophy",
  msd_trophy: "MSD Trophy",
  hertford_builders_trophy: "Hertford Builders Trophy",
  closed_championship: "Closed Championship",
  club_championship: "Club Championship",
  friendly: "Friendly",
};

export const FIXTURE_STATUS = ["scheduled", "played", "postponed", "cancelled", "void"] as const;
export type FixtureStatus = (typeof FIXTURE_STATUS)[number];

export const FIXTURE_RESULT = ["win", "loss", "draw"] as const;
export type FixtureResult = (typeof FIXTURE_RESULT)[number];

export const FIXTURE_RESULT_LABELS: Record<FixtureResult, string> = {
  win: "Won",
  loss: "Lost",
  draw: "Drawn",
};

export const NEWS_CATEGORY = ["news", "match_report", "notice", "newsletter"] as const;
export type NewsCategory = (typeof NEWS_CATEGORY)[number];

export const EVENT_STATUS = ["scheduled", "cancelled", "completed"] as const;
export type EventStatus = (typeof EVENT_STATUS)[number];

export const DOCUMENT_CATEGORY = [
  "constitution",
  "minutes",
  "forms",
  "policies",
  "handbook",
  "newsletter",
  "other",
] as const;
export type DocumentCategory = (typeof DOCUMENT_CATEGORY)[number];

export const DOCUMENT_CATEGORY_LABELS: Record<DocumentCategory, string> = {
  constitution: "Constitution",
  minutes: "Committee minutes",
  forms: "Forms",
  policies: "Policies (safeguarding, data, health & safety)",
  handbook: "Handbook",
  newsletter: "Newsletter",
  other: "Other",
};

export const ENQUIRY_TYPE = ["join", "coaching", "juniors", "venue_hire", "general"] as const;
export type EnquiryType = (typeof ENQUIRY_TYPE)[number];

export const ENQUIRY_TYPE_LABELS: Record<EnquiryType, string> = {
  join: "I'd like to join the club",
  coaching: "Coaching",
  juniors: "Juniors",
  venue_hire: "Hiring the hall",
  general: "Something else",
};

export const ENQUIRY_STATUS = ["new", "in_progress", "answered", "spam"] as const;
export type EnquiryStatus = (typeof ENQUIRY_STATUS)[number];

export const SPONSOR_TIER = ["principal", "supporting", "friend"] as const;
export type SponsorTier = (typeof SPONSOR_TIER)[number];

export const MEMBERSHIP_PERIOD = ["season", "month", "session"] as const;
export type MembershipPeriod = (typeof MEMBERSHIP_PERIOD)[number];

export const MEMBERSHIP_PERIOD_LABELS: Record<MembershipPeriod, string> = {
  season: "per season",
  month: "per month",
  session: "per session",
};

export const HONOUR_TYPE = ["team", "individual"] as const;
export type HonourType = (typeof HONOUR_TYPE)[number];
