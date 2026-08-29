import { readItems, readSingleton, createItem } from "@directus/sdk";
import type {
  Club,
  ClubDetail,
  ClubDocument,
  ClubEvent,
  ClubSession,
  CommitteeRole,
  ExternalLink,
  Faq,
  Fixture,
  FixtureDetail,
  GalleryAlbum,
  GalleryAlbumDetail,
  HomePayload,
  Honour,
  MemberProfile,
  MemberSummary,
  NewsItem,
  Page,
  PlayerStat,
  Rubber,
  Season,
  SiteSettings,
  Standing,
  Team,
  TeamDetail,
  Venue,
} from "../shared/types.js";
import type { EnquiryInput } from "../shared/schema.js";
import type { Division } from "../shared/enums.js";
import { directus } from "./lib/directus.js";

/*
 * Server code imports `../shared/*` by relative path, never through the
 * `@shared` alias the client uses. Vite rewrites that alias when it bundles
 * the browser build; nothing rewrites it for the serverless function, which
 * Vercel compiles file by file and runs as plain ESM. An alias here reaches
 * Node as a bare package specifier and takes down every route in the
 * function with ERR_MODULE_NOT_FOUND.
 */

/**
 * Directus rows arrive loosely typed — the generic client has no generated
 * schema behind it — so every row is narrowed here, at the boundary, and
 * nothing beyond this file sees a Directus shape. One mapper per collection
 * means a renamed column is one compile error, not a scatter of undefineds
 * in components.
 */
type Row = Record<string, any>;

const PUBLISHED = { status: { _eq: "published" } } as const;

function str(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * `npm run seed` writes realistic-looking starter content so that layouts
 * and empty states can be judged against something with the right shape:
 * an address, a match report, a welcome notice, a safeguarding page. Every
 * one of those bodies opens with the word PLACEHOLDER, and none of it is
 * true.
 *
 * The seed's own README says to replace it before the site goes anywhere
 * near the public. That instruction was followed for the pages someone
 * happened to look at, and not for the rest — so the league's home page
 * carried "Welcome to the new club website" and a match report invented
 * out of nothing, presented exactly as real news.
 *
 * Marking it is only useful if something acts on the mark, so this is the
 * boundary that does: placeholder text never leaves the API. Editors still
 * see it in Directus, which is where it earns its keep.
 */
const PLACEHOLDER = /^\s*PLACEHOLDER\b/i;

export function isPlaceholder(value: unknown): boolean {
  return typeof value === "string" && PLACEHOLDER.test(value);
}

/** Free text that is dropped rather than published when it is placeholder. */
function publicText(value: unknown): string | null {
  return isPlaceholder(value) ? null : str(value);
}

function num(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function int(value: unknown): number {
  return num(value) ?? 0;
}

/** A relation Directus returned as a nested object, or `null` if it came back as a bare id. */
function rel(value: unknown): Row | null {
  return value && typeof value === "object" ? (value as Row) : null;
}

/** A file relation, which is either a nested object with an id or the id itself. */
function fileId(value: unknown): string | null {
  if (typeof value === "string") return value;
  const nested = rel(value);
  return nested ? str(nested.id) : null;
}

// ---------------------------------------------------------------------------
// Mappers
// ---------------------------------------------------------------------------

function toSeason(row: Row): Season {
  return {
    id: row.id,
    label: row.label,
    slug: row.slug,
    startsOn: str(row.starts_on),
    endsOn: str(row.ends_on),
    isCurrent: Boolean(row.is_current),
  };
}

function toVenue(row: Row): Venue {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    addressLine1: publicText(row.address_line_1),
    addressLine2: str(row.address_line_2),
    town: str(row.town),
    postcode: str(row.postcode),
    mapUrl: str(row.map_url),
    directions: publicText(row.directions),
    parkingNotes: publicText(row.parking_notes),
    accessibilityNotes: publicText(row.accessibility_notes),
    tableCount: num(row.table_count),
    isHomeVenue: Boolean(row.is_home_venue),
    photoId: fileId(row.photo),
  };
}

function toMemberSummary(row: Row): MemberSummary {
  return {
    id: row.id,
    fullName: row.full_name,
    displayName: str(row.display_name),
    slug: row.slug,
    photoId: fileId(row.photo),
    isCoach: Boolean(row.is_coach),
    isCommittee: Boolean(row.is_committee),
  };
}

function toTeam(row: Row): Team {
  const season = rel(row.season);
  const captain = rel(row.captain);
  const venue = rel(row.home_venue);
  const club = rel(row.club);
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    division: row.division,
    homeNight: row.home_night ?? null,
    homeStartTime: str(row.home_start_time),
    description: str(row.description),
    teamPhotoId: fileId(row.team_photo),
    captain: captain ? toMemberSummary(captain) : null,
    homeVenue: venue ? toVenue(venue) : null,
    seasonLabel: season?.label ?? "",
    clubName: club?.name ?? null,
    clubSlug: club?.slug ?? null,
  };
}

function toFixture(row: Row): Fixture {
  const team = rel(row.team);
  const venue = rel(row.venue);
  return {
    id: row.id,
    playedOn: str(row.played_on),
    startTime: str(row.start_time),
    weekCommencing: str(row.week_commencing),
    competition: row.competition ?? "league",
    opponentName: row.opponent_name ?? "",
    isHome: Boolean(row.is_home),
    status: row.status ?? "scheduled",
    result: row.result ?? null,
    hrcScore: num(row.hrc_score),
    opponentScore: num(row.opponent_score),
    scorecardUrl: str(row.scorecard_url),
    teamName: team?.name ?? "",
    teamSlug: team?.slug ?? "",
    venueName: venue?.name ?? null,
    lastSyncedAt: str(row.last_synced_at),
  };
}

function toRubber(row: Row): Rubber {
  const member = rel(row.member);
  return {
    id: row.id,
    rubberNumber: int(row.rubber_number),
    memberName: member?.full_name ?? null,
    memberSlug: member?.slug ?? null,
    opponentPlayerName: str(row.opponent_player_name),
    setsFor: int(row.sets_for),
    setsAgainst: int(row.sets_against),
    won: Boolean(row.won),
    scoreDetail: str(row.score_detail),
  };
}

function toStanding(row: Row): Standing {
  return {
    id: row.id,
    division: row.division,
    position: int(row.position),
    teamName: row.team_name ?? "",
    isHrc: Boolean(row.is_hrc),
    played: int(row.played),
    won: int(row.won),
    drawn: int(row.drawn),
    lost: int(row.lost),
    setsFor: int(row.sets_for),
    setsAgainst: int(row.sets_against),
    points: int(row.points),
    lastSyncedAt: str(row.last_synced_at),
  };
}

function toPlayerStat(row: Row): PlayerStat {
  const member = rel(row.member);
  const season = rel(row.season);
  const team = rel(row.team);
  return {
    id: row.id,
    memberName: member?.full_name ?? "",
    memberSlug: member?.slug ?? "",
    seasonLabel: season?.label ?? "",
    teamName: team?.name ?? null,
    division: row.division ?? null,
    played: int(row.played),
    won: int(row.won),
    lost: int(row.lost),
    winPercentage: num(row.win_percentage),
    handicap: num(row.handicap),
    meetsParticipationThreshold: Boolean(row.meets_participation_threshold),
  };
}

function toNews(row: Row): NewsItem {
  const author = rel(row.author);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    summary: str(row.summary),
    body: str(row.body),
    category: row.category ?? "news",
    isPinned: Boolean(row.is_pinned),
    publishedAt: str(row.published_at),
    heroImageId: fileId(row.hero_image),
    attachmentId: fileId(row.attachment),
    authorName: author?.full_name ?? null,
    fixtureId: typeof row.fixture === "string" ? row.fixture : (rel(row.fixture)?.id ?? null),
  };
}

function toEvent(row: Row): ClubEvent {
  const venue = rel(row.venue);
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    startsAt: str(row.starts_at),
    endsAt: str(row.ends_at),
    description: str(row.description),
    status: row.status ?? "scheduled",
    isMembersOnly: Boolean(row.is_members_only),
    entryUrl: str(row.entry_url),
    costNote: str(row.cost_note),
    heroImageId: fileId(row.hero_image),
    venueName: venue?.name ?? null,
  };
}

function toSession(row: Row): ClubSession {
  const venue = rel(row.venue);
  const coach = rel(row.lead_coach);
  return {
    id: row.id,
    name: row.name,
    dayOfWeek: row.day_of_week,
    startTime: str(row.start_time),
    endTime: str(row.end_time),
    sessionType: row.session_type ?? "club_night",
    suitableFor: str(row.suitable_for),
    costNote: str(row.cost_note),
    notes: str(row.notes),
    venue: venue ? toVenue(venue) : null,
    leadCoachName: coach?.full_name ?? null,
  };
}

function toHonour(row: Row): Honour {
  const member = rel(row.member);
  const team = rel(row.team);
  return {
    id: row.id,
    title: row.title,
    honourType: row.honour_type ?? "team",
    competition: row.competition ?? null,
    competitionName: str(row.competition_name),
    seasonLabel: row.season_label ?? "",
    recipientName: str(row.recipient_name) ?? member?.full_name ?? null,
    notes: str(row.notes),
    memberSlug: member?.slug ?? null,
    teamName: team?.name ?? null,
    photoId: fileId(row.photo),
  };
}

function toPage(row: Row): Page {
  return {
    id: row.id,
    title: row.title,
    subtitle: str(row.subtitle),
    slug: row.slug,
    // The page still exists, with its title and its place in the menu —
    // it simply has nothing written in it yet, which is what the reader is
    // told. A safeguarding page whose text says it "must be written by the
    // club's safeguarding officer" is worse than an honest blank.
    body: publicText(row.body),
    heroImageId: fileId(row.hero_image),
    seoDescription: str(row.seo_description),
    publishedAt: str(row.published_at),
    updatedAt: str(row.date_updated),
  };
}

function toDocument(row: Row): ClubDocument {
  return {
    id: row.id,
    title: row.title,
    slug: row.slug,
    category: row.category ?? "other",
    description: str(row.description),
    documentDate: str(row.document_date),
    fileId: fileId(row.file),
    /*
     * The import copies each form into Directus so it outlives the old
     * site, but falls back to a link for any it could not fetch. That
     * fallback was written to the database and then never served, so a
     * document with no local copy rendered as a title with nothing to
     * click.
     */
    externalUrl: str(row.external_url),
  };
}

// ---------------------------------------------------------------------------
// Queries
// ---------------------------------------------------------------------------

export async function getSettings(): Promise<SiteSettings> {
  const client = await directus();
  const row = (await client.request(
    readSingleton("hrc_site_settings" as never, {
      fields: ["*", { current_season: ["*"] }],
    }),
  )) as Row;

  const season = rel(row?.current_season);
  const expires = str(row?.announcement_expires_at);
  // The banner takes itself down. A committee that has to remember to
  // remove "tonight is cancelled" is a committee that leaves it up.
  const announcementLive = !expires || new Date(expires).getTime() > Date.now();

  return {
    clubName: row?.club_name ?? "HRC Table Tennis Club",
    shortName: str(row?.short_name),
    strapline: str(row?.strapline),
    foundedYear: num(row?.founded_year),
    aboutSummary: str(row?.about_summary),
    contactEmail: str(row?.contact_email),
    phone: str(row?.phone),
    facebookUrl: str(row?.facebook_url),
    instagramUrl: str(row?.instagram_url),
    leagueUrl: str(row?.league_url),
    logoId: fileId(row?.logo),
    crestId: fileId(row?.crest),
    announcement: announcementLive ? str(row?.announcement) : null,
    currentSeason: season ? toSeason(season) : null,
  };
}

export async function getSeasons(): Promise<Season[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_seasons", { fields: ["*"], sort: ["-label"], limit: -1 }),
  )) as Row[];
  return rows.map(toSeason);
}

export async function getCurrentSeason(): Promise<Season | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_seasons", { fields: ["*"], filter: { is_current: { _eq: true } }, limit: 1 }),
  )) as Row[];
  if (rows[0]) return toSeason(rows[0]);

  // Fall back to the most recent season rather than returning nothing —
  // a forgotten `is_current` tick should not empty the whole site.
  const latest = (await client.request(
    readItems("hrc_seasons", { fields: ["*"], sort: ["-label"], limit: 1 }),
  )) as Row[];
  return latest[0] ? toSeason(latest[0]) : null;
}

async function seasonIdFor(label?: string): Promise<string | null> {
  if (!label) {
    const current = await getCurrentSeason();
    return current?.id ?? null;
  }
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_seasons", { fields: ["id"], filter: { slug: { _eq: label } }, limit: 1 }),
  )) as Row[];
  return rows[0]?.id ?? null;
}

let homeClubCache: { id: string; slug: string } | null = null;

/**
 * The club whose site this is. Cached for the life of the process: it
 * changes when somebody ticks a different box in Directus, which is not
 * something worth a database round trip on every request.
 */
async function getHomeClub(): Promise<{ id: string; slug: string } | null> {
  if (homeClubCache) return homeClubCache;
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_clubs", { fields: ["id", "slug"], filter: { is_home_club: { _eq: true } }, limit: 1 }),
  )) as Row[];
  if (!rows[0]) return null;
  homeClubCache = { id: rows[0].id, slug: rows[0].slug };
  return homeClubCache;
}

const CLUB_FIELDS = [
  "*",
  { venue: ["*"] },
  { teams: ["id", "division"] },
  { members: ["id"] },
] as const;

function toClub(row: Row): Club {
  const venue = rel(row.venue);
  const teams = Array.isArray(row.teams) ? row.teams : [];
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    shortName: str(row.short_name),
    isHomeClub: Boolean(row.is_home_club),
    description: str(row.description),
    website: str(row.website),
    logoId: fileId(row.logo),
    venue: venue ? toVenue(venue) : null,
    teamCount: teams.length,
    playerCount: Array.isArray(row.members) ? row.members.length : 0,
    divisions: [...new Set(teams.map((t: Row) => t.division).filter(Boolean))] as Division[],
  };
}

export async function getClubs(): Promise<Club[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_clubs", {
      fields: CLUB_FIELDS as unknown as string[],
      sort: ["sort", "name"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toClub);
}

export async function getClub(slug: string): Promise<ClubDetail | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_clubs", {
      fields: CLUB_FIELDS as unknown as string[],
      filter: { slug: { _eq: slug } },
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return null;

  const teamRows = (await client.request(
    readItems("hrc_teams", {
      fields: TEAM_FIELDS as unknown as string[],
      filter: { club: { _eq: rows[0].id } },
      sort: ["sort", "name"],
      limit: -1,
    }),
  )) as Row[];

  const squadRows = (await client.request(
    readItems("hrc_squads", {
      fields: [
        "id",
        "sort",
        { team: ["name", "slug", "sort"] },
        { member: MEMBER_PUBLIC_FIELDS as unknown as string[] },
      ],
      filter: { team: { club: { _eq: rows[0].id } } },
      sort: ["team.sort", "sort"],
      limit: -1,
    }),
  )) as Row[];

  const squads = teamRows.map((team) => ({
    teamName: team.name,
    teamSlug: team.slug,
    players: squadRows
      .filter((place) => rel(place.team)?.slug === team.slug)
      .map((place) => toMemberSummary(rel(place.member) ?? {})),
  }));

  return { ...toClub(rows[0]), teams: teamRows.map(toTeam), squads };
}

export async function getPages(): Promise<Page[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_pages", { fields: ["*"], filter: PUBLISHED, sort: ["nav_sort", "title"], limit: -1 }),
  )) as Row[];
  return rows.map(toPage);
}

export async function getPage(slug: string): Promise<Page | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_pages", {
      fields: ["*"],
      filter: { _and: [PUBLISHED, { slug: { _eq: slug } }] },
      limit: 1,
    }),
  )) as Row[];
  return rows[0] ? toPage(rows[0]) : null;
}

export async function getSessions(): Promise<ClubSession[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_sessions", {
      fields: ["*", { venue: ["*"] }, { lead_coach: ["full_name", "slug"] }],
      filter: { is_active: { _eq: true } },
      sort: ["sort", "start_time"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toSession);
}

export async function getVenues(): Promise<Venue[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_venues", { fields: ["*"], sort: ["-is_home_venue", "name"], limit: -1 }),
  )) as Row[];
  return rows.map(toVenue);
}

export async function getVenue(slug: string): Promise<Venue | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_venues", { fields: ["*"], filter: { slug: { _eq: slug } }, limit: 1 }),
  )) as Row[];
  return rows[0] ? toVenue(rows[0]) : null;
}

const TEAM_FIELDS = [
  "*",
  { club: ["id", "name", "slug"] },
  { season: ["id", "label", "slug"] },
  { captain: ["id", "full_name", "display_name", "slug", "photo", "is_coach", "is_committee"] },
  { home_venue: ["*"] },
] as const;

export async function getTeams(seasonSlug?: string, clubSlug?: string): Promise<Team[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(seasonSlug);

  // Unqualified, "teams" means our own — the site holds all 26 in the
  // league, and a visitor asking for our teams does not want the other 22.
  const club = clubSlug ? { slug: clubSlug } : await getHomeClub();
  const filter: Record<string, unknown>[] = [];
  if (seasonId) filter.push({ season: { _eq: seasonId } });
  if (club) filter.push(clubSlug ? { club: { slug: { _eq: clubSlug } } } : { club: { _eq: (club as { id: string }).id } });

  const rows = (await client.request(
    readItems("hrc_teams", {
      fields: TEAM_FIELDS as unknown as string[],
      filter: filter.length ? { _and: filter } : {},
      sort: ["sort", "name"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toTeam);
}

export async function getTeam(slug: string): Promise<TeamDetail | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_teams", {
      fields: TEAM_FIELDS as unknown as string[],
      filter: { slug: { _eq: slug } },
      sort: ["-season.label"],
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return null;

  const team = toTeam(rows[0]);
  const teamId = rows[0].id;

  const [squadRows, fixtureRows, standingRows] = await Promise.all([
    client.request(
      readItems("hrc_squads", {
        fields: [
          "id",
          "role",
          { member: ["id", "full_name", "display_name", "slug", "photo", "is_coach", "is_committee"] },
        ],
        filter: { _and: [{ team: { _eq: teamId } }, { is_active: { _eq: true } }] },
        sort: ["sort"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
    client.request(
      readItems("hrc_fixtures", {
        fields: ["*", { team: ["name", "slug"] }, { venue: ["name"] }],
        filter: { team: { _eq: teamId } },
        sort: ["played_on"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
    client.request(
      readItems("hrc_standings", {
        fields: ["*"],
        filter: { _and: [{ division: { _eq: rows[0].division } }, { is_hrc: { _eq: true } }, { team_name: { _eq: rows[0].name } }] },
        limit: 1,
      }),
    ) as Promise<Row[]>,
  ]);

  const fixtures = fixtureRows.map(toFixture);

  return {
    ...team,
    squad: squadRows.map((row) => ({
      id: row.id,
      role: row.role ?? "player",
      member: toMemberSummary(rel(row.member) ?? {}),
    })),
    fixtures: fixtures.filter((f) => f.status === "scheduled" || f.status === "postponed"),
    results: fixtures.filter((f) => f.status === "played").reverse(),
    standing: standingRows[0] ? toStanding(standingRows[0]) : null,
  };
}

export interface FixtureQuery {
  season?: string;
  team?: string;
  status?: string;
  competition?: string;
  limit?: number;
}

export async function getFixtures(query: FixtureQuery = {}): Promise<Fixture[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(query.season);

  const filter: Record<string, unknown>[] = [];
  if (seasonId) filter.push({ season: { _eq: seasonId } });
  if (query.team) filter.push({ team: { slug: { _eq: query.team } } });
  if (query.status) filter.push({ status: { _eq: query.status } });
  if (query.competition === "cup") {
    // Everything that is not league business — the club-site equivalent of
    // the league's "Cup News" page.
    filter.push({ competition: { _neq: "league" } });
  } else if (query.competition) {
    filter.push({ competition: { _eq: query.competition } });
  }

  const rows = (await client.request(
    readItems("hrc_fixtures", {
      fields: ["*", { team: ["name", "slug"] }, { venue: ["name"] }],
      filter: filter.length ? { _and: filter } : {},
      sort: query.status === "played" ? ["-played_on"] : ["played_on"],
      limit: query.limit ?? -1,
    }),
  )) as Row[];
  return rows.map(toFixture);
}

export async function getFixture(id: string): Promise<FixtureDetail | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_fixtures", {
      fields: ["*", { team: ["name", "slug"] }, { venue: ["name"] }],
      filter: { id: { _eq: id } },
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return null;

  const [rubberRows, reportRows] = await Promise.all([
    client.request(
      readItems("hrc_rubbers", {
        fields: ["*", { member: ["full_name", "slug"] }],
        filter: { fixture: { _eq: id } },
        sort: ["rubber_number"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
    client.request(
      readItems("hrc_news", {
        fields: ["title", "slug"],
        filter: { _and: [PUBLISHED, { fixture: { _eq: id } }] },
        limit: 1,
      }),
    ) as Promise<Row[]>,
  ]);

  return {
    ...toFixture(rows[0]),
    report: str(rows[0].report),
    reportImageId: fileId(rows[0].report_image),
    rubbers: rubberRows.map(toRubber),
    linkedReport: reportRows[0] ? { title: reportRows[0].title, slug: reportRows[0].slug } : null,
  };
}

export async function getStandings(seasonSlug?: string, division?: string): Promise<Standing[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(seasonSlug);
  const filter: Record<string, unknown>[] = [];
  if (seasonId) filter.push({ season: { _eq: seasonId } });
  if (division) filter.push({ division: { _eq: division } });

  const rows = (await client.request(
    readItems("hrc_standings", {
      fields: ["*"],
      filter: filter.length ? { _and: filter } : {},
      sort: ["division", "position"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toStanding);
}

export async function getPlayerStats(seasonSlug?: string): Promise<PlayerStat[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(seasonSlug);
  const rows = (await client.request(
    readItems("hrc_player_stats", {
      fields: [
        "*",
        { member: ["full_name", "slug"] },
        { season: ["label"] },
        { team: ["name"] },
      ],
      filter: seasonId ? { season: { _eq: seasonId } } : {},
      sort: ["-win_percentage", "-won"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toPlayerStat);
}

export async function getNews(category?: string, limit = 50): Promise<NewsItem[]> {
  const client = await directus();
  const filter: Record<string, unknown>[] = [PUBLISHED];
  if (category) filter.push({ category: { _eq: category } });

  const rows = (await client.request(
    readItems("hrc_news", {
      fields: ["*", { author: ["full_name"] }],
      filter: { _and: filter },
      sort: ["-is_pinned", "-published_at"],
      limit,
    }),
  )) as Row[];
  return rows.filter((row) => !isPlaceholder(row.body)).map(toNews);
}

export async function getNewsItem(slug: string): Promise<NewsItem | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_news", {
      fields: ["*", { author: ["full_name"] }],
      filter: { _and: [PUBLISHED, { slug: { _eq: slug } }] },
      limit: 1,
    }),
  )) as Row[];
  return rows[0] && !isPlaceholder(rows[0].body) ? toNews(rows[0]) : null;
}

export async function getEvents(includePast = false): Promise<ClubEvent[]> {
  const client = await directus();
  const filter: Record<string, unknown>[] = [{ status: { _neq: "cancelled" } }];
  if (!includePast) filter.push({ starts_at: { _gte: new Date().toISOString() } });

  const rows = (await client.request(
    readItems("hrc_events", {
      fields: ["*", { venue: ["name"] }],
      filter: { _and: filter },
      sort: ["starts_at"],
      limit: -1,
    }),
  )) as Row[];
  return rows.filter((row) => !isPlaceholder(row.description)).map(toEvent);
}

export async function getEvent(slug: string): Promise<ClubEvent | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_events", {
      fields: ["*", { venue: ["name"] }],
      filter: { slug: { _eq: slug } },
      limit: 1,
    }),
  )) as Row[];
  return rows[0] && !isPlaceholder(rows[0].description) ? toEvent(rows[0]) : null;
}

const MEMBER_PUBLIC_FIELDS = [
  "id",
  "full_name",
  "display_name",
  "slug",
  "bio",
  "photo",
  "status",
  "joined_year",
  "is_coach",
  "is_committee",
] as const;

export async function getMembers(): Promise<MemberSummary[]> {
  const client = await directus();
  const homeClub = await getHomeClub();
  const filter: Record<string, unknown>[] = [{ show_on_site: { _eq: true } }];
  // Our players, not the league's 165.
  if (homeClub) filter.push({ club: { _eq: homeClub.id } });

  const rows = (await client.request(
    readItems("hrc_members", {
      fields: MEMBER_PUBLIC_FIELDS as unknown as string[],
      filter: { _and: filter },
      sort: ["full_name"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toMemberSummary);
}

export async function getMember(slug: string): Promise<MemberProfile | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_members", {
      fields: MEMBER_PUBLIC_FIELDS as unknown as string[],
      filter: { _and: [{ show_on_site: { _eq: true } }, { slug: { _eq: slug } }] },
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return null;

  const memberId = rows[0].id;
  const [statRows, squadRows, honourRows] = await Promise.all([
    client.request(
      readItems("hrc_player_stats", {
        fields: ["*", { member: ["full_name", "slug"] }, { season: ["label"] }, { team: ["name"] }],
        filter: { member: { _eq: memberId } },
        sort: ["-season.label"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
    client.request(
      readItems("hrc_squads", {
        fields: ["role", { team: ["name", "slug"] }, { season: ["label"] }],
        filter: { member: { _eq: memberId } },
        sort: ["-season.label"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
    client.request(
      readItems("hrc_honours", {
        fields: ["*", { member: ["full_name", "slug"] }, { team: ["name"] }],
        filter: { member: { _eq: memberId } },
        sort: ["-season_label"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
  ]);

  return {
    ...toMemberSummary(rows[0]),
    bio: str(rows[0].bio),
    joinedYear: num(rows[0].joined_year),
    status: rows[0].status ?? "active",
    stats: statRows.map(toPlayerStat),
    squadPlaces: squadRows.map((row) => ({
      teamName: rel(row.team)?.name ?? "",
      teamSlug: rel(row.team)?.slug ?? "",
      seasonLabel: rel(row.season)?.label ?? "",
      role: row.role ?? "player",
    })),
    honours: honourRows.map(toHonour),
  };
}

export async function getGalleryAlbums(): Promise<GalleryAlbum[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_gallery_albums", {
      fields: ["*", { items: ["id"] }],
      filter: PUBLISHED,
      sort: ["-taken_on", "sort"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map((row) => ({
    id: row.id,
    title: row.title,
    slug: row.slug,
    description: str(row.description),
    takenOn: str(row.taken_on),
    coverImageId: fileId(row.cover_image),
    itemCount: Array.isArray(row.items) ? row.items.length : 0,
  }));
}

export async function getGalleryAlbum(slug: string): Promise<GalleryAlbumDetail | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_gallery_albums", {
      fields: ["*"],
      filter: { _and: [PUBLISHED, { slug: { _eq: slug } }] },
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return null;

  const items = (await client.request(
    readItems("hrc_gallery_items", {
      fields: ["id", "caption", "image", "sort"],
      filter: { album: { _eq: rows[0].id } },
      sort: ["sort"],
      limit: -1,
    }),
  )) as Row[];

  return {
    id: rows[0].id,
    title: rows[0].title,
    slug: rows[0].slug,
    description: str(rows[0].description),
    takenOn: str(rows[0].taken_on),
    coverImageId: fileId(rows[0].cover_image),
    itemCount: items.length,
    items: items.map((row) => ({
      id: row.id,
      caption: row.caption ?? "",
      imageId: fileId(row.image),
    })),
  };
}

export async function getDocuments(): Promise<ClubDocument[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_documents", {
      fields: ["*"],
      filter: { is_public: { _eq: true } },
      sort: ["category", "sort", "-document_date"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toDocument);
}

export async function getHonours(): Promise<Honour[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_honours", {
      fields: ["*", { member: ["full_name", "slug"] }, { team: ["name"] }],
      sort: ["-season_label", "sort"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toHonour);
}


export async function getCommitteeRoles(): Promise<CommitteeRole[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_committee_roles", {
      fields: ["*", { member: MEMBER_PUBLIC_FIELDS as unknown as string[] }],
      filter: { is_active: { _eq: true } },
      sort: ["sort"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map((row) => {
    const member = rel(row.member);
    return {
      id: row.id,
      roleTitle: row.role_title,
      // A linked member is the better source — it carries a slug, so the
      // name can link to their player page. `holder_name` is the fallback
      // for a committee member who does not play.
      holderName: member ? null : str(row.holder_name),
      publicEmail: str(row.public_email),
      responsibilities: str(row.responsibilities),
      member: member ? toMemberSummary(member) : null,
    };
  });
}


export async function getLinks(): Promise<ExternalLink[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_links", {
      fields: ["*"],
      filter: { is_active: { _eq: true } },
      sort: ["category", "sort", "label"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map((row) => ({
    id: row.id,
    label: row.label,
    url: row.url,
    category: str(row.category),
    description: str(row.description),
  }));
}

export async function getFaqs(): Promise<Faq[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_faqs", {
      fields: ["*"],
      filter: { is_published: { _eq: true } },
      sort: ["sort"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map((row) => ({
    id: row.id,
    question: row.question,
    answer: str(row.answer),
    category: str(row.category),
  }));
}

export async function createEnquiry(input: EnquiryInput): Promise<{ id: string }> {
  const client = await directus();
  const created = (await client.request(
    createItem("hrc_enquiries", {
      name: input.name,
      email: input.email,
      phone: input.phone || null,
      enquiry_type: input.enquiryType,
      message: input.message,
      source_page: input.sourcePage ?? null,
      status: "new",
    }),
  )) as Row;
  return { id: created?.id ?? "" };
}

/**
 * The home page in one request rather than seven. The page is the busiest
 * on the site and its whole point is to be instant; seven round trips to
 * Directus on a cold serverless function is the opposite of that.
 */
export async function getHome(): Promise<HomePayload> {
  const [settings, nextFixtures, latestResults, news, events, sessions, standings, counts] =
    await Promise.all([
      getSettings(),
      getFixtures({ status: "scheduled", limit: 5 }),
      getFixtures({ status: "played", limit: 5 }),
      getNews(undefined, 4),
      getEvents(),
      getSessions(),
      getStandings(),
      getLeagueCounts(),
    ]);

  return {
    settings,
    nextFixtures,
    latestResults,
    news,
    events: events.slice(0, 3),
    sessions,
    standings,
    counts,
  };
}

/**
 * The four numbers the home page opens on — clubs, teams, divisions, and
 * how far back the honours run.
 *
 * They are counted rather than written down. The league's own home page
 * states its size in a sentence ("10 clubs in the league, providing 26
 * teams spread over the 3 divisions"), which was accurate on the day it
 * was typed and is one new team away from being wrong — the site this
 * replaces announced three teams above a list of four.
 *
 * Each query asks for `id` alone, so this is four narrow reads rather than
 * four full collections.
 */
async function getLeagueCounts(): Promise<HomePayload["counts"]> {
  const client = await directus();

  const [clubs, teams, honours] = await Promise.all([
    client.request(readItems("hrc_clubs", { fields: ["id"], limit: -1 })) as Promise<Row[]>,
    client.request(readItems("hrc_teams", { fields: ["id", "division"], limit: -1 })) as Promise<Row[]>,
    client.request(
      readItems("hrc_honours", { fields: ["season_label"], sort: ["season_label"], limit: 1 }),
    ) as Promise<Row[]>,
  ]);

  // Season labels are either a year ("1950") or a season ("2025-26"); the
  // first four digits are the year either way.
  const earliest = Number(String(honours[0]?.season_label ?? "").slice(0, 4));

  return {
    clubs: clubs.length,
    teams: teams.length,
    divisions: new Set(teams.map((row) => row.division).filter(Boolean)).size,
    honoursFrom: Number.isFinite(earliest) && earliest > 1900 ? earliest : null,
  };
}
