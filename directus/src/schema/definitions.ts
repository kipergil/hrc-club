import {
  COMPETITION,
  COMPETITION_LABELS,
  DAY_OF_WEEK,
  DIVISION,
  DIVISION_LABELS,
  DOCUMENT_CATEGORY,
  DOCUMENT_CATEGORY_LABELS,
  ENQUIRY_STATUS,
  ENQUIRY_TYPE,
  ENQUIRY_TYPE_LABELS,
  EVENT_STATUS,
  FIXTURE_RESULT,
  FIXTURE_RESULT_LABELS,
  FIXTURE_STATUS,
  HONOUR_TYPE,
  MEMBER_STATUS,
  MEMBERSHIP_PERIOD,
  MEMBERSHIP_PERIOD_LABELS,
  NAV_GROUP,
  NAV_GROUP_LABELS,
  NEWS_CATEGORY,
  PAGE_STATUS,
  SESSION_TYPE,
  SESSION_TYPE_LABELS,
  SPONSOR_TIER,
  SQUAD_ROLE,
} from "../../../shared/enums.js";
import {
  booleanField,
  dateCreatedField,
  dateOnlyField,
  dateUpdatedField,
  decimalField,
  fileField,
  idField,
  integerField,
  m2o,
  richTextField,
  selectField,
  slugField,
  textField,
  timeOnlyField,
  timestampField,
} from "./presets.js";
import type { CollectionDefinition } from "./types.js";

/**
 * The Directus "folder" every collection below is filed under.
 *
 * This Directus instance is shared with several unrelated projects
 * (BucketBoard, PinGather, LocalRater, the health network), each of which
 * already owns a folder and a set of collection names — including generic
 * ones like `pages`, `tags` and `categories`. Two rules keep this project
 * from colliding with any of them, and both are load-bearing rather than
 * cosmetic:
 *
 *  1. Every collection is prefixed `hrc_`. `pages` is already taken; ours
 *     is `hrc_pages`.
 *  2. Every collection sets `meta.group` to this folder, so the club's 25
 *     collections appear as one collapsible group in the data model rather
 *     than scattered through a 60-row alphabetical list.
 *
 * The tooling in this package only ever creates — it never updates or
 * deletes a collection, field or relation it did not create, so running it
 * against the shared instance cannot disturb another project's schema.
 */
export const HRC_FOLDER = "hrc_club";

// ---------------------------------------------------------------------------
// Reference data — seasons, venues, people
// ---------------------------------------------------------------------------

export const seasonsCollection: CollectionDefinition = {
  collection: "hrc_seasons",
  icon: "calendar_month",
  note: "A playing season, e.g. 2026-27. Almost everything else is scoped to one; `is_current` is what the site reads to decide which.",
  displayTemplate: "{{label}}",
  fields: [
    idField(),
    textField("label", {
      required: true,
      unique: true,
      maxLength: 16,
      note: 'Season as players write it, e.g. "2026-27".',
    }),
    slugField("slug", { note: 'URL segment, e.g. "2026-27" in /seasons/2026-27.' }),
    dateOnlyField("starts_on", { note: "First day of the season." }),
    dateOnlyField("ends_on", { note: "Last day of the season." }),
    booleanField(
      "is_current",
      false,
      "Exactly one season should have this set. The home page, fixtures, tables and averages all read it.",
    ),
    textField("league_season_ref", {
      nullable: true,
      note: "Identifier for the same season in the league's own system, for the fixture/result sync.",
    }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [],
};

export const venuesCollection: CollectionDefinition = {
  collection: "hrc_venues",
  icon: "place",
  note: "Halls the club plays in — its own home venue and any away venue worth giving directions to.",
  displayTemplate: "{{name}}",
  fields: [
    idField(),
    textField("name", { required: true, note: 'e.g. "Hertford Rugby Club, main hall".' }),
    slugField(),
    textField("address_line_1", { nullable: true }),
    textField("address_line_2", { nullable: true }),
    textField("town", { nullable: true }),
    textField("postcode", { nullable: true, maxLength: 16 }),
    textField("map_url", {
      nullable: true,
      note: "Link to the venue on a maps provider. Opened in a new tab from the venue page.",
    }),
    decimalField("latitude", { precision: 10, scale: 7, note: "Optional — only needed if an embedded map is added later." }),
    decimalField("longitude", { precision: 10, scale: 7 }),
    richTextField("directions", { note: "Plain-English directions, written for someone who has never been." }),
    richTextField("parking_notes", { note: "Where to park, what it costs, how full it gets on a match night." }),
    richTextField("accessibility_notes", {
      note: "Step-free access, accessible toilet, hearing loop, lighting. Required content, not optional — see the PRD's audience.",
    }),
    integerField("table_count", { nullable: true, note: "How many tables are up." }),
    booleanField("is_home_venue", false, "Marks the club's own home. Drives the 'Where we play' page."),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [fileField("hrc_venues", "photo", { note: "Photo of the hall, so first-time visitors recognise it." })],
};

export const membersCollection: CollectionDefinition = {
  collection: "hrc_members",
  icon: "person",
  note:
    "A club member. Contact fields are private by default and never included in the public API projection — `show_on_site` governs whether the member appears publicly at all.",
  displayTemplate: "{{full_name}}",
  fields: [
    idField(),
    textField("full_name", { required: true }),
    slugField("slug", { note: "URL segment for /players/:slug." }),
    textField("display_name", { nullable: true, note: "Shown instead of full_name where set — nicknames, shortened names." }),
    richTextField("bio", { note: "Short profile. Optional; most members will not have one." }),
    selectField("status", MEMBER_STATUS, { defaultValue: "active", nullable: false }),
    integerField("joined_year", { nullable: true, note: "Year they first joined HRC." }),
    booleanField(
      "show_on_site",
      false,
      "Opt-in, not opt-out: nothing about a member is published until this is ticked. Defaults off so a new registration is private until someone consents.",
    ),
    booleanField("is_coach", false),
    booleanField("is_committee", false, "Convenience flag; the actual roles live in hrc_committee_roles."),
    // Contact details: held so the club can run itself, never served publicly.
    // The service policy's read rule on this collection excludes them.
    textField("email", { nullable: true, note: "PRIVATE — never returned by the public API." }),
    textField("phone", { nullable: true, maxLength: 32, note: "PRIVATE — never returned by the public API." }),
    textField("league_player_ref", {
      nullable: true,
      note: "Identifier for this player in the league's system, used to attach synced averages and handicaps.",
    }),
    textField("clerk_user_id", {
      nullable: true,
      unique: true,
      note:
        "External identity from Clerk, set when a member first signs in. Deliberately here rather than as a custom field on directus_users — this instance's directus_users is shared with other projects and must not be extended by this one.",
    }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_members", "club", "hrc_clubs", {
      template: "{{name}}",
      oneField: "members",
      onDelete: "CASCADE",
      note: "Which club the player is registered with. The site holds every league player, so this is what separates our own members from the rest.",
    }),
    fileField("hrc_members", "photo", { note: "Head-and-shoulders photo. Only published when show_on_site is ticked." }),
  ],
};

// ---------------------------------------------------------------------------
// Teams and squads
// ---------------------------------------------------------------------------

export const clubsCollection: CollectionDefinition = {
  collection: "hrc_clubs",
  icon: "diversity_3",
  note:
    "Every club in the league, HRC included. The site covers the whole league, so an opponent is a real page with a venue and squads rather than a name in a fixture list — which is also what makes 'where are we playing on Thursday' answerable.",
  displayTemplate: "{{name}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("name", { required: true, note: 'As the league names it, e.g. "Water Lane", "St. Andrews".' }),
    slugField("slug", { note: "URL segment for /clubs/:slug." }),
    textField("short_name", { nullable: true, maxLength: 32 }),
    textField("league_ref", {
      nullable: true,
      note: "The club's identifier in the league's own URLs (Clubz.asp?Club=...), which is what the importer matches on.",
    }),
    booleanField(
      "is_home_club",
      false,
      "Marks the club whose site this is. Exactly one should have it — it is what the home page, the timetable and 'our teams' read.",
    ),
    richTextField("description", { note: "Anything worth saying about the club beyond its address." }),
    textField("website", { nullable: true }),
    integerField("sort", { defaultValue: 0 }),
    timestampField("last_synced_at", { note: "When the league import last wrote to this club." }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_clubs", "venue", "hrc_venues", {
      template: "{{name}}",
      oneField: "clubs",
      onDelete: "SET NULL",
      note: "Where the club plays. Two clubs can share a hall, which is why the venue is referenced rather than owned.",
    }),
    fileField("hrc_clubs", "logo"),
  ],
};

export const teamsCollection: CollectionDefinition = {
  collection: "hrc_teams",
  icon: "groups",
  note: "An HRC team in a given season — HRC A, HRC B, HRC C. One row per team per season, so history is preserved when a team changes division.",
  displayTemplate: "{{name}} ({{division}})",
  sortField: "sort",
  fields: [
    idField(),
    textField("name", { required: true, note: 'As the league writes it, e.g. "HRC A".' }),
    slugField("slug", { note: 'URL segment, e.g. "hrc-a" in /teams/hrc-a — matches the league\'s own new URL scheme.' }),
    selectField("division", DIVISION, { labels: DIVISION_LABELS, nullable: false, required: true }),
    selectField("home_night", DAY_OF_WEEK, { note: "The night this team plays at home." }),
    timeOnlyField("home_start_time", { note: "Usual start time for a home match." }),
    booleanField("is_active", true, "Untick rather than delete when a team folds — its fixtures and results stay readable."),
    integerField("sort", { defaultValue: 0, note: "Display order: A, B, C." }),
    textField("league_team_ref", {
      nullable: true,
      note: 'Identifier in the league system, e.g. "HRC A", used by the fixture sync.',
    }),
    richTextField("description", { note: "A sentence or two about the team's level, for someone deciding where they might fit." }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_teams", "club", "hrc_clubs", {
      required: true,
      nullable: true,
      template: "{{name}}",
      oneField: "teams",
      onDelete: "CASCADE",
      note: "Nullable in the database only because the column was added to a table that already had rows; every team the importer writes has one.",
    }),
    m2o("hrc_teams", "season", "hrc_seasons", {
      required: true,
      nullable: false,
      template: "{{label}}",
      oneField: "teams",
      onDelete: "CASCADE",
    }),
    m2o("hrc_teams", "captain", "hrc_members", {
      template: "{{full_name}}",
      oneField: "captained_teams",
      onDelete: "SET NULL",
      note: "Captain for this season. SET NULL so removing a member does not delete the team.",
    }),
    m2o("hrc_teams", "home_venue", "hrc_venues", {
      template: "{{name}}",
      oneField: "home_teams",
      onDelete: "SET NULL",
    }),
    fileField("hrc_teams", "team_photo"),
  ],
};

export const squadsCollection: CollectionDefinition = {
  collection: "hrc_squads",
  icon: "badge",
  note:
    "Which members are registered for which team in which season. The join row, not a copy of the member — a player who moves from the B to the A team gets a second row, and last season's squad list stays correct.",
  displayTemplate: "{{member.full_name}} — {{team.name}}",
  fields: [
    idField(),
    selectField("role", SQUAD_ROLE, { defaultValue: "player", nullable: false }),
    dateOnlyField("registered_on", { note: "Date the league registration was accepted." }),
    booleanField("is_active", true, "Untick when a player leaves the squad mid-season; the row stays for the record."),
    integerField("sort", { defaultValue: 0, note: "Board order within the team." }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_squads", "team", "hrc_teams", {
      required: true,
      nullable: false,
      template: "{{name}}",
      oneField: "squad",
      onDelete: "CASCADE",
    }),
    m2o("hrc_squads", "member", "hrc_members", {
      required: true,
      nullable: false,
      template: "{{full_name}}",
      oneField: "squad_places",
      onDelete: "CASCADE",
    }),
    m2o("hrc_squads", "season", "hrc_seasons", {
      required: true,
      nullable: false,
      template: "{{label}}",
      oneField: "squad_places",
      onDelete: "CASCADE",
    }),
  ],
};

// ---------------------------------------------------------------------------
// League data mirrored from the league system (Tier B)
// ---------------------------------------------------------------------------

export const fixturesCollection: CollectionDefinition = {
  collection: "hrc_fixtures",
  icon: "sports_tennis",
  note:
    "Every match an HRC team plays, fixture and result in one row. Mirrored from the league's data by the sync job — `league_fixture_ref` and `last_synced_at` are what make the sync idempotent. Club-authored fields (report, photos) survive re-sync because the sync only writes the columns it owns.",
  displayTemplate: "{{played_on}} — {{team.name}} v {{opponent_name}}",
  fields: [
    idField(),
    dateOnlyField("played_on", { note: "Match date. The site's single ordering key for fixtures and results." }),
    timeOnlyField("start_time"),
    dateOnlyField("week_commencing", {
      note: "Monday of the league week. The league schedules by week; this is what the fixture calendar groups on.",
    }),
    selectField("competition", COMPETITION, {
      labels: COMPETITION_LABELS,
      defaultValue: "league",
      nullable: false,
    }),
    textField("opponent_name", { required: true, note: 'Opposing team as the league names it, e.g. "Water Lane B".' }),
    textField("opponent_slug", { nullable: true, note: "Slug of the opposing team, for linking to the league site." }),
    booleanField("is_home", true, "Home or away. Never the only signal in the UI — it always carries a text label too."),
    selectField("status", FIXTURE_STATUS, { defaultValue: "scheduled", nullable: false }),
    selectField("result", FIXTURE_RESULT, {
      labels: FIXTURE_RESULT_LABELS,
      note: "From HRC's point of view, regardless of home or away. Null until the card is confirmed.",
    }),
    integerField("hrc_score", { nullable: true, note: "Rubbers won by HRC." }),
    integerField("opponent_score", { nullable: true, note: "Rubbers won by the opposition." }),
    textField("league_fixture_ref", {
      nullable: true,
      unique: true,
      note: "Stable identifier in the league system. The sync matches on this, so re-running it updates rather than duplicates.",
    }),
    textField("scorecard_url", { nullable: true, note: "Deep link to the full scorecard on the league site." }),
    richTextField("report", {
      note: "Club-written match report. Authored here, never touched by the sync.",
    }),
    timestampField("last_synced_at", { note: "When the sync last wrote to this row. Shown as 'last updated' on the fixtures page." }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_fixtures", "team", "hrc_teams", {
      required: true,
      nullable: false,
      template: "{{name}}",
      oneField: "fixtures",
      onDelete: "CASCADE",
    }),
    m2o("hrc_fixtures", "season", "hrc_seasons", {
      required: true,
      nullable: false,
      template: "{{label}}",
      oneField: "fixtures",
      onDelete: "CASCADE",
    }),
    m2o("hrc_fixtures", "venue", "hrc_venues", {
      template: "{{name}}",
      oneField: "fixtures",
      onDelete: "SET NULL",
      note: "Where it is played. For away matches this is the opposition's hall, if known.",
    }),
    fileField("hrc_fixtures", "report_image"),
  ],
};

export const rubbersCollection: CollectionDefinition = {
  collection: "hrc_rubbers",
  icon: "scoreboard",
  note:
    "Individual rubbers within a match — the club's own copy of the scorecard. Optional detail: a fixture is complete and displayable without any rubber rows.",
  displayTemplate: "{{rubber_number}}. {{member.full_name}} v {{opponent_player_name}}",
  sortField: "rubber_number",
  fields: [
    idField(),
    integerField("rubber_number", { defaultValue: 1, nullable: false, note: "Order on the card, 1-9." }),
    textField("opponent_player_name", { nullable: true }),
    integerField("sets_for", { defaultValue: 0, note: "Sets won by the HRC player." }),
    integerField("sets_against", { defaultValue: 0 }),
    booleanField("won", false, "Whether the HRC player won the rubber."),
    textField("score_detail", {
      nullable: true,
      note: 'Set scores as written on the card, e.g. "11-8, 9-11, 11-6, 11-7".',
    }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_rubbers", "fixture", "hrc_fixtures", {
      required: true,
      nullable: false,
      oneField: "rubbers",
      onDelete: "CASCADE",
    }),
    m2o("hrc_rubbers", "member", "hrc_members", {
      template: "{{full_name}}",
      oneField: "rubbers",
      onDelete: "SET NULL",
      note: "The HRC player. SET NULL rather than CASCADE so removing a member never erases match history.",
    }),
  ],
};

export const standingsCollection: CollectionDefinition = {
  collection: "hrc_standings",
  icon: "leaderboard",
  note:
    "A cached league table row, mirrored from the league. Includes every team in the division, not just HRC's — a table showing only your own row is useless. Wholly owned by the sync; never edited by hand.",
  displayTemplate: "{{division}} {{position}}. {{team_name}}",
  fields: [
    idField(),
    selectField("division", DIVISION, { labels: DIVISION_LABELS, nullable: false, required: true }),
    integerField("position", { defaultValue: 0, nullable: false }),
    textField("team_name", { required: true }),
    booleanField("is_hrc", false, "Marks HRC's own rows so the table can highlight them — with a text label, never colour alone."),
    integerField("played", { defaultValue: 0 }),
    integerField("won", { defaultValue: 0 }),
    integerField("drawn", { defaultValue: 0 }),
    integerField("lost", { defaultValue: 0 }),
    integerField("sets_for", { defaultValue: 0 }),
    integerField("sets_against", { defaultValue: 0 }),
    integerField("points", { defaultValue: 0 }),
    timestampField("last_synced_at"),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_standings", "season", "hrc_seasons", {
      required: true,
      nullable: false,
      template: "{{label}}",
      oneField: "standings",
      onDelete: "CASCADE",
    }),
  ],
};

export const playerStatsCollection: CollectionDefinition = {
  collection: "hrc_player_stats",
  icon: "query_stats",
  note:
    "Per-member, per-season playing record — the club's slice of the league averages, plus the handicap. One row per member per season per team.",
  displayTemplate: "{{member.full_name}} {{season.label}}",
  fields: [
    idField(),
    selectField("division", DIVISION, { labels: DIVISION_LABELS }),
    integerField("played", { defaultValue: 0 }),
    integerField("won", { defaultValue: 0 }),
    integerField("lost", { defaultValue: 0 }),
    decimalField("win_percentage", {
      precision: 5,
      scale: 2,
      note: "Stored rather than computed on read so the averages page is a plain select with no arithmetic on the request path.",
    }),
    integerField("handicap", { nullable: true, note: "League handicap rating for the season." }),
    booleanField(
      "meets_participation_threshold",
      false,
      "The league's 50% rule: below it a player is listed but not eligible for the averages placings. Explained in plain English next to the table, per the PRD.",
    ),
    timestampField("last_synced_at"),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_player_stats", "member", "hrc_members", {
      required: true,
      nullable: false,
      template: "{{full_name}}",
      oneField: "season_stats",
      onDelete: "CASCADE",
    }),
    m2o("hrc_player_stats", "season", "hrc_seasons", {
      required: true,
      nullable: false,
      template: "{{label}}",
      oneField: "player_stats",
      onDelete: "CASCADE",
    }),
    m2o("hrc_player_stats", "team", "hrc_teams", {
      template: "{{name}}",
      oneField: "player_stats",
      onDelete: "SET NULL",
    }),
  ],
};

export const honoursCollection: CollectionDefinition = {
  collection: "hrc_honours",
  icon: "emoji_events",
  note:
    "The club's roll of honour — titles, trophies and individual awards, by season. The league audit called its 1970-onwards honours the single most valuable thing on the site; this is the club-scale equivalent, and the one collection worth back-filling by hand from paper records.",
  displayTemplate: "{{season_label}} — {{title}}",
  fields: [
    idField(),
    textField("title", { required: true, note: 'e.g. "Division 1 champions", "Creasey Cup winners".' }),
    selectField("honour_type", HONOUR_TYPE, { defaultValue: "team", nullable: false }),
    selectField("competition", COMPETITION, { labels: COMPETITION_LABELS }),
    textField("competition_name", {
      nullable: true,
      note:
        "The competition as the league writes it. Free text rather than the enum beside it because the Hall of Fame spans 55 years and 21 competitions, several of which have been renamed — \"Open Singles (Men's Singles to 2004)\" is one entry, not two.",
    }),
    textField("season_label", {
      required: true,
      maxLength: 16,
      note:
        'Season as text, e.g. "1974-75". Deliberately a string as well as an optional hrc_seasons link — honours go back further than the seasons the site will ever hold rows for.',
    }),
    dateOnlyField("awarded_on"),
    textField("recipient_name", {
      nullable: true,
      note: "Free-text recipient, for historic honours won by people who are not (and never will be) hrc_members rows.",
    }),
    richTextField("notes"),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_honours", "season", "hrc_seasons", {
      template: "{{label}}",
      oneField: "honours",
      onDelete: "SET NULL",
      note: "Optional — only set for seasons the site actually holds.",
    }),
    m2o("hrc_honours", "member", "hrc_members", {
      template: "{{full_name}}",
      oneField: "honours",
      onDelete: "SET NULL",
      note: "Set for individual honours where the recipient is a current member row.",
    }),
    m2o("hrc_honours", "team", "hrc_teams", {
      template: "{{name}}",
      oneField: "honours",
      onDelete: "SET NULL",
    }),
    fileField("hrc_honours", "photo"),
  ],
};

// ---------------------------------------------------------------------------
// Editorial content (Tier A / Tier B)
// ---------------------------------------------------------------------------

export const pagesCollection: CollectionDefinition = {
  collection: "hrc_pages",
  icon: "article",
  note:
    "Editable static pages — about the club, how to join, coaching, safeguarding, privacy. Everything the committee should be able to reword without a deploy.",
  displayTemplate: "{{title}}",
  sortField: "nav_sort",
  fields: [
    idField(),
    textField("title", { required: true, note: "The page name players already use. Not reworded — see the PRD's 'new look, same map'." }),
    textField("subtitle", {
      nullable: true,
      note: 'The plain-English one-liner shown beneath the title, e.g. "Where and when we play". An addition to the name, never a replacement.',
    }),
    slugField(),
    richTextField("body", { note: "Markdown. Rendered server-side so the page is readable with JavaScript off." }),
    selectField("status", PAGE_STATUS, { defaultValue: "draft", nullable: false }),
    selectField("nav_group", NAV_GROUP, {
      labels: NAV_GROUP_LABELS,
      defaultValue: "about",
      nullable: false,
      note: "Which of the five top-level menu entries this page sits under.",
    }),
    integerField("nav_sort", { defaultValue: 0 }),
    textField("seo_description", { nullable: true, maxLength: 200 }),
    timestampField("published_at"),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [fileField("hrc_pages", "hero_image")],
};

export const newsCollection: CollectionDefinition = {
  collection: "hrc_news",
  icon: "campaign",
  note: "News, notices, match reports and newsletters. The one collection the club will write to weekly.",
  displayTemplate: "{{title}}",
  fields: [
    idField(),
    textField("title", { required: true }),
    slugField(),
    textField("summary", {
      nullable: true,
      maxLength: 300,
      note: "One or two sentences, shown in listings and used as the meta description.",
    }),
    richTextField("body"),
    selectField("category", NEWS_CATEGORY, { defaultValue: "news", nullable: false }),
    selectField("status", PAGE_STATUS, { defaultValue: "draft", nullable: false }),
    booleanField("is_pinned", false, "Keeps an item at the top of the news list and on the home page until unticked."),
    timestampField("published_at", { note: "Ordering key for the news list. Set when status first becomes published." }),
    timestampField("expires_at", { note: "Optional — notices disappear from the home page after this, but stay readable at their own URL." }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_news", "author", "hrc_members", {
      template: "{{full_name}}",
      oneField: "articles",
      onDelete: "SET NULL",
    }),
    m2o("hrc_news", "fixture", "hrc_fixtures", {
      oneField: "reports",
      onDelete: "SET NULL",
      note: "Set on a match report to link it to the match it is about, and vice versa.",
    }),
    fileField("hrc_news", "hero_image"),
    fileField("hrc_news", "attachment", { image: false, note: "PDF newsletter, where the item is a newsletter rather than a post." }),
  ],
};

export const eventsCollection: CollectionDefinition = {
  collection: "hrc_events",
  icon: "event",
  note: "Club events with a date — AGM, presentation evening, club championship, open days, socials.",
  displayTemplate: "{{title}} — {{starts_at}}",
  fields: [
    idField(),
    textField("title", { required: true }),
    slugField(),
    timestampField("starts_at", { note: "Ordering key. Events in the past drop off the home page but keep their URL." }),
    timestampField("ends_at"),
    richTextField("description"),
    selectField("status", EVENT_STATUS, { defaultValue: "scheduled", nullable: false }),
    booleanField("is_members_only", false),
    textField("entry_url", { nullable: true, note: "External entry or booking link, where there is one." }),
    textField("cost_note", { nullable: true, note: 'Plain English, e.g. "£5 on the night, juniors free".' }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_events", "venue", "hrc_venues", { template: "{{name}}", oneField: "events", onDelete: "SET NULL" }),
    fileField("hrc_events", "hero_image"),
  ],
};

export const sessionsCollection: CollectionDefinition = {
  collection: "hrc_sessions",
  icon: "schedule",
  note:
    "The weekly timetable — club nights, junior sessions, coaching. The single most-visited piece of information on any club website: when can I turn up and play?",
  displayTemplate: "{{name}} — {{day_of_week}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("name", { required: true, note: 'e.g. "Club night", "Junior coaching".' }),
    selectField("day_of_week", DAY_OF_WEEK, { nullable: false, required: true }),
    timeOnlyField("start_time", { nullable: false }),
    timeOnlyField("end_time"),
    selectField("session_type", SESSION_TYPE, {
      labels: SESSION_TYPE_LABELS,
      defaultValue: "club_night",
      nullable: false,
    }),
    textField("suitable_for", {
      nullable: true,
      note: 'Plain English, e.g. "All abilities, adults and juniors 11+". Answers the question a beginner actually has.',
    }),
    textField("cost_note", { nullable: true, note: 'e.g. "£4 members, £6 visitors".' }),
    booleanField("is_active", true, "Untick out of season rather than deleting."),
    richTextField("notes"),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_sessions", "venue", "hrc_venues", {
      required: true,
      nullable: false,
      template: "{{name}}",
      oneField: "sessions",
      onDelete: "CASCADE",
    }),
    m2o("hrc_sessions", "lead_coach", "hrc_members", {
      template: "{{full_name}}",
      oneField: "led_sessions",
      onDelete: "SET NULL",
    }),
  ],
};

export const membershipOptionsCollection: CollectionDefinition = {
  collection: "hrc_membership_options",
  icon: "card_membership",
  note: "Membership tiers and fees, as shown on the 'Join us' page.",
  displayTemplate: "{{name}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("name", { required: true, note: 'e.g. "Adult", "Junior (under 18)", "Student".' }),
    integerField("price_pence", {
      defaultValue: 0,
      nullable: false,
      note: "Stored in pence to avoid float rounding. Formatted for display by the client.",
    }),
    selectField("period", MEMBERSHIP_PERIOD, {
      labels: MEMBERSHIP_PERIOD_LABELS,
      defaultValue: "season",
      nullable: false,
    }),
    richTextField("includes", { note: "What the fee covers, as a short list." }),
    booleanField("is_active", true),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [],
};

export const committeeRolesCollection: CollectionDefinition = {
  collection: "hrc_committee_roles",
  icon: "gavel",
  note:
    "Who does what. Carries a role-based public email (chair@…) rather than a personal address, so the page needs no edit when the post changes hands and no personal address is published.",
  displayTemplate: "{{role_title}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("role_title", { required: true, note: 'e.g. "Chair", "Match secretary", "Safeguarding officer".' }),
    /*
     * Who currently holds the post, for the common case where they are not
     * a registered player and so have no `hrc_members` row to point at.
     *
     * Without it the league import had nowhere to put a name and folded it
     * into the title — "Chairperson — Jo Swain" — which left `member` null,
     * so the committee page rendered every filled post as "Vacant — could
     * this be you?" directly beneath the name of the person holding it.
     */
    textField("holder_name", {
      nullable: true,
      note: "The person in the post, when they are not a registered player. If `member` is set, that wins.",
    }),
    textField("public_email", {
      nullable: true,
      note: "Role-based address, safe to publish. Personal addresses live on hrc_members and are never served.",
    }),
    richTextField("responsibilities"),
    integerField("sort", { defaultValue: 0 }),
    booleanField("is_active", true),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_committee_roles", "member", "hrc_members", {
      template: "{{full_name}}",
      oneField: "committee_roles",
      onDelete: "SET NULL",
    }),
  ],
};

export const documentsCollection: CollectionDefinition = {
  collection: "hrc_documents",
  icon: "description",
  note: "Downloadable files — constitution, minutes, membership form, safeguarding policy.",
  displayTemplate: "{{title}}",
  fields: [
    idField(),
    textField("title", { required: true }),
    slugField(),
    selectField("category", DOCUMENT_CATEGORY, {
      labels: DOCUMENT_CATEGORY_LABELS,
      defaultValue: "other",
      nullable: false,
    }),
    richTextField("description", { note: "One line saying what the document is, so nobody downloads a PDF to find out." }),
    dateOnlyField("document_date", { note: "Date on the document itself — the meeting date for minutes." }),
    textField("external_url", {
      nullable: true,
      note:
        "Where the document lives if it is not held in the file library — a form still hosted on the old league site, say. `file` is preferred: a link to somebody else's server is a link that eventually breaks.",
    }),
    booleanField("is_public", true, "Untick for documents only members should see."),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    fileField("hrc_documents", "file", { image: false, note: "The file itself, served through the app rather than linked directly." }),
  ],
};

export const galleryAlbumsCollection: CollectionDefinition = {
  collection: "hrc_gallery_albums",
  icon: "photo_library",
  note: "A set of photos from one occasion — presentation night, a cup final, an open day.",
  displayTemplate: "{{title}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("title", { required: true }),
    slugField(),
    richTextField("description"),
    dateOnlyField("taken_on"),
    selectField("status", PAGE_STATUS, { defaultValue: "draft", nullable: false }),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [fileField("hrc_gallery_albums", "cover_image")],
};

export const galleryItemsCollection: CollectionDefinition = {
  collection: "hrc_gallery_items",
  icon: "image",
  note: "One photo in an album. `caption` doubles as the alt text — required, not optional, for the same accessibility reasons the PRD sets out.",
  displayTemplate: "{{caption}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("caption", {
      required: true,
      note: "Also used as the image's alt text. Describe what is in the photo, not 'photo'.",
    }),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
  ],
  relationFields: [
    m2o("hrc_gallery_items", "album", "hrc_gallery_albums", {
      required: true,
      nullable: false,
      template: "{{title}}",
      oneField: "items",
      onDelete: "CASCADE",
    }),
    fileField("hrc_gallery_items", "image"),
  ],
};

export const sponsorsCollection: CollectionDefinition = {
  collection: "hrc_sponsors",
  icon: "handshake",
  note: "Sponsors and supporters, shown in the footer and on a sponsors page.",
  displayTemplate: "{{name}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("name", { required: true }),
    textField("url", { nullable: true }),
    selectField("tier", SPONSOR_TIER, { defaultValue: "supporting", nullable: false }),
    richTextField("description"),
    booleanField("is_active", true),
    integerField("sort", { defaultValue: 0 }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [fileField("hrc_sponsors", "logo")],
};

export const linksCollection: CollectionDefinition = {
  collection: "hrc_links",
  icon: "link",
  note: "Outward links — the league site, Table Tennis England, the county association, local clubs.",
  displayTemplate: "{{label}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("label", { required: true }),
    textField("url", { required: true }),
    textField("category", { nullable: true, maxLength: 64 }),
    richTextField("description"),
    integerField("sort", { defaultValue: 0 }),
    booleanField("is_active", true),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [],
};

export const faqsCollection: CollectionDefinition = {
  collection: "hrc_faqs",
  icon: "help",
  note:
    "The 'How do I…?' content the PRD asks for — the handful of questions a newcomer or an older member actually asks, answered in plain English.",
  displayTemplate: "{{question}}",
  sortField: "sort",
  fields: [
    idField(),
    textField("question", { required: true }),
    richTextField("answer"),
    textField("category", { nullable: true, maxLength: 64 }),
    integerField("sort", { defaultValue: 0 }),
    booleanField("is_published", true),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [],
};

export const enquiriesCollection: CollectionDefinition = {
  collection: "hrc_enquiries",
  icon: "mail",
  note:
    "Submissions from the contact and join forms. The only collection the public can write to, and the only one the service token may create rows in without an authenticated member behind the request — so it is rate-limited, honeypot-protected and moderated. Never publicly readable.",
  displayTemplate: "{{name}} — {{enquiry_type}}",
  fields: [
    idField(),
    textField("name", { required: true }),
    textField("email", { required: true }),
    textField("phone", { nullable: true, maxLength: 32 }),
    selectField("enquiry_type", ENQUIRY_TYPE, {
      labels: ENQUIRY_TYPE_LABELS,
      defaultValue: "general",
      nullable: false,
    }),
    richTextField("message", { interface: "input-multiline" }),
    selectField("status", ENQUIRY_STATUS, { defaultValue: "new", nullable: false }),
    textField("source_page", { nullable: true, note: "Path the form was submitted from, for working out which page prompts enquiries." }),
    richTextField("internal_notes", { interface: "input-multiline", note: "Committee-only. Never returned to the submitter." }),
    dateCreatedField(),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_enquiries", "handled_by", "hrc_members", {
      template: "{{full_name}}",
      oneField: "handled_enquiries",
      onDelete: "SET NULL",
    }),
  ],
};

export const siteSettingsCollection: CollectionDefinition = {
  collection: "hrc_site_settings",
  icon: "settings",
  singleton: true,
  note:
    "One row. Club identity and the few site-wide switches the committee should own — name, strapline, contact address, social links, and the banner that goes up when a session is cancelled.",
  fields: [
    idField(),
    textField("club_name", { required: true, defaultValue: "HRC Table Tennis Club" }),
    textField("short_name", { nullable: true, maxLength: 16, defaultValue: "HRC" }),
    textField("strapline", { nullable: true, note: "One line, shown under the club name in the header." }),
    integerField("founded_year", { nullable: true }),
    richTextField("about_summary", { note: "Two or three sentences for the home page and search results." }),
    textField("contact_email", { nullable: true, note: "Role-based, publishable address." }),
    textField("phone", { nullable: true, maxLength: 32 }),
    textField("facebook_url", { nullable: true }),
    textField("instagram_url", { nullable: true }),
    textField("league_url", {
      nullable: true,
      defaultValue: "https://hertsttl.org.uk",
      note: "The league site. Linked from fixtures, tables and averages as the source of the data.",
    }),
    richTextField("announcement", {
      interface: "input-multiline",
      note: "Site-wide banner — a cancelled session, a change of hall. Empty means no banner.",
    }),
    timestampField("announcement_expires_at", { note: "Banner hides itself after this, so nobody has to remember to take it down." }),
    dateUpdatedField(),
  ],
  relationFields: [
    m2o("hrc_site_settings", "current_season", "hrc_seasons", {
      template: "{{label}}",
      onDelete: "SET NULL",
      note: "Redundant with hrc_seasons.is_current, and deliberately so — this is the one the admin panel makes obvious.",
    }),
    fileField("hrc_site_settings", "logo"),
    fileField("hrc_site_settings", "crest"),
    fileField("hrc_site_settings", "og_image", { note: "Link-preview image for social shares." }),
  ],
};

/**
 * Order matters only for readability — apply.ts creates every collection
 * first, then every relation, so a collection may reference one defined
 * below it.
 */
export const allCollections: CollectionDefinition[] = [
  seasonsCollection,
  venuesCollection,
  clubsCollection,
  membersCollection,
  teamsCollection,
  squadsCollection,
  fixturesCollection,
  rubbersCollection,
  standingsCollection,
  playerStatsCollection,
  honoursCollection,
  pagesCollection,
  newsCollection,
  eventsCollection,
  sessionsCollection,
  membershipOptionsCollection,
  committeeRolesCollection,
  documentsCollection,
  galleryAlbumsCollection,
  galleryItemsCollection,
  sponsorsCollection,
  linksCollection,
  faqsCollection,
  enquiriesCollection,
  siteSettingsCollection,
];
