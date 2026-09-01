import { createItem, createItems, deleteItems, readItems, readSingleton, updateItem } from "@directus/sdk";
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
  PlayerRubber,
  PlayerStat,
  Rubber,
  Season,
  SiteSettings,
  Standing,
  Team,
  TeamDetail,
  TeamFixture,
  TeamRef,
  Venue,
} from "../shared/types.js";
import type { EnquiryInput } from "../shared/schema.js";
import { DIVISION, type Division } from "../shared/enums.js";
import { matchScoreOf, outcomeOf } from "../shared/scorecard.js";
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
    // Resolved once by `npm run directus:geocode:venues` and stored, so a
    // map never waits on a geocoding service from someone's phone.
    latitude: num(row.latitude),
    longitude: num(row.longitude),
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

function toTeamRef(row: Row | null): TeamRef {
  return {
    name: row?.name ?? "",
    slug: row?.slug ?? "",
    division: row?.division ?? null,
  };
}

function toFixture(row: Row): Fixture {
  const venue = rel(row.venue);
  return {
    id: row.id,
    playedOn: str(row.played_on),
    startTime: str(row.start_time),
    weekCommencing: str(row.week_commencing),
    competition: row.competition ?? "league",
    status: row.status ?? "scheduled",
    homeTeam: toTeamRef(rel(row.home_team)),
    awayTeam: toTeamRef(rel(row.away_team)),
    homeScore: num(row.home_score),
    awayScore: num(row.away_score),
    scorecardUrl: str(row.scorecard_url),
    venueName: venue?.name ?? null,
    lastSyncedAt: str(row.last_synced_at),
  };
}

/**
 * The same match, told from one team's side.
 *
 * A result is not a property of a match, it is a property of a match and a
 * point of view: 6–4 is a win for the home team and a loss for the away
 * one. Storing it would mean storing it twice and keeping the two in step,
 * so it is worked out here instead, once, wherever a team's own list is
 * being built.
 */
function toTeamFixture(fixture: Fixture, teamSlug: string): TeamFixture {
  const isHome = fixture.homeTeam.slug === teamSlug;
  const teamScore = isHome ? fixture.homeScore : fixture.awayScore;
  const opponentScore = isHome ? fixture.awayScore : fixture.homeScore;

  return {
    ...fixture,
    isHome,
    opponent: isHome ? fixture.awayTeam : fixture.homeTeam,
    teamScore,
    opponentScore,
    result:
      teamScore === null || opponentScore === null
        ? null
        : teamScore > opponentScore
          ? "win"
          : teamScore < opponentScore
            ? "loss"
            : "draw",
  };
}

/** A rubber's player, where the site holds a member record for them. */
function toRubberPlayer(member: Row | null, fallback: unknown): { name: string; slug: string | null } | null {
  if (member) return { name: member.full_name ?? "", slug: member.slug ?? null };
  const name = str(fallback);
  // A guest, or a name nobody has reconciled to a member yet. Shown, but
  // it links nowhere, because there is no profile behind it.
  return name ? { name, slug: null } : null;
}

function toRubber(row: Row): Rubber {
  const home = [
    toRubberPlayer(rel(row.home_player), row.home_player_name),
    toRubberPlayer(rel(row.home_player_2), null),
  ].filter((player): player is { name: string; slug: string | null } => player !== null);
  const away = [
    toRubberPlayer(rel(row.away_player), row.away_player_name),
    toRubberPlayer(rel(row.away_player_2), null),
  ].filter((player): player is { name: string; slug: string | null } => player !== null);

  return {
    id: row.id,
    rubberNumber: int(row.rubber_number),
    kind: row.kind === "doubles" ? "doubles" : "singles",
    home,
    away,
    homeSets: int(row.home_sets),
    awaySets: int(row.away_sets),
    games: Array.isArray(row.games) ? (row.games as Array<[number, number]>) : [],
  };
}

function toStanding(row: Row): Standing {
  return {
    id: row.id,
    division: row.division,
    position: int(row.position),
    teamName: rel(row.team)?.name ?? row.team_name ?? "",
    teamSlug: rel(row.team)?.slug ?? null,
    isHrc: Boolean(row.is_hrc),
    played: int(row.played),
    // `num`, not `int`: an archived table has no wins column, and zero is
    // a claim about the season rather than an absence of one.
    won: num(row.won),
    drawn: num(row.drawn),
    lost: num(row.lost),
    setsFor: num(row.sets_for),
    setsAgainst: num(row.sets_against),
    points: int(row.points),
    seasonIncomplete: seasonIncompleteOf(rel(row.season)),
    lastSyncedAt: str(row.last_synced_at),
  };
}

/** `completed` is the ordinary case and says nothing worth showing. */
function seasonIncompleteOf(season: Row | null): Standing["seasonIncomplete"] {
  const completion = season?.completion;
  return completion === "abandoned" || completion === "cancelled" ? completion : null;
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

/**
 * Every team in the league for a season, ignoring the home-club default.
 *
 * `getTeams()` unqualified means "our teams", which is right for a club's
 * own site and wrong for a league table: it computed the Premier Division
 * from four teams and left the other two divisions off the page entirely.
 */
export async function getAllTeams(seasonSlug?: string): Promise<Team[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(seasonSlug);

  const rows = (await client.request(
    readItems("hrc_teams", {
      fields: TEAM_FIELDS as unknown as string[],
      filter: seasonId ? { season: { _eq: seasonId } } : {},
      sort: ["sort", "name"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toTeam);
}

export async function getTeam(slug: string, seasonSlug?: string): Promise<TeamDetail | null> {
  const client = await directus();
  const seasonId = await seasonIdFor(seasonSlug);

  /*
   * A team slug identifies a team within a season, not outright: this
   * collection holds one row per team per season so that a promotion is
   * history rather than an edit. Without a season the most recent row
   * wins, which is what someone following a bare /teams/hrc-a means.
   */
  const teamFilter: Record<string, unknown>[] = [{ slug: { _eq: slug } }];
  if (seasonId) teamFilter.push({ season: { _eq: seasonId } });

  const rows = (await client.request(
    readItems("hrc_teams", {
      fields: TEAM_FIELDS as unknown as string[],
      filter: { _and: teamFilter },
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
        fields: FIXTURE_FIELDS as unknown as string[],
        // Both halves of the fixture. Filtering on a single `team` column
        // only ever found the matches this side happened to be entered as.
        filter: {
          _and: [
            { season: { _eq: rel(rows[0].season)?.id } },
            { _or: [{ home_team: { _eq: teamId } }, { away_team: { _eq: teamId } }] },
          ],
        },
        sort: ["played_on"],
        limit: -1,
      }),
    ) as Promise<Row[]>,
    // The row for this team in its division's table, computed from results
    // like every other row rather than looked up by name.
    getStandings(rel(rows[0].season)?.slug, rows[0].division),
  ]);

  const teamFixtures = fixtureRows.map((row) => toTeamFixture(toFixture(row), slug));

  return {
    ...team,
    squad: squadRows.map((row) => ({
      id: row.id,
      role: row.role ?? "player",
      member: toMemberSummary(rel(row.member) ?? {}),
    })),
    fixtures: teamFixtures.filter((f) => f.status === "scheduled" || f.status === "postponed"),
    results: teamFixtures.filter((f) => f.status === "played").reverse(),
    standing: standingRows.find((row) => row.teamSlug === slug) ?? null,
  };
}

const FIXTURE_FIELDS = [
  "*",
  { home_team: ["name", "slug", "division"] },
  { away_team: ["name", "slug", "division"] },
  { venue: ["name"] },
] as const;

export interface FixtureQuery {
  season?: string;
  team?: string;
  division?: string;
  status?: string;
  competition?: string;
  limit?: number;
}

export async function getFixtures(query: FixtureQuery = {}): Promise<Fixture[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(query.season);

  const filter: Record<string, unknown>[] = [];
  if (seasonId) filter.push({ season: { _eq: seasonId } });
  // A team's matches are the ones it plays either half of. This is the whole
  // reason both sides are relations: as an `opponent_name` string there was
  // no way to ask this question.
  if (query.team) {
    filter.push({
      _or: [{ home_team: { slug: { _eq: query.team } } }, { away_team: { slug: { _eq: query.team } } }],
    });
  }
  if (query.division) {
    filter.push({ home_team: { division: { _eq: query.division } } });
  }
  if (query.status) filter.push({ status: { _eq: query.status } });
  if (query.competition === "cup") {
    // Everything that is not league business — the league's "Cup News" page.
    filter.push({ competition: { _neq: "league" } });
  } else if (query.competition) {
    filter.push({ competition: { _eq: query.competition } });
  }

  const rows = (await client.request(
    readItems("hrc_fixtures", {
      fields: FIXTURE_FIELDS as unknown as string[],
      filter: filter.length ? { _and: filter } : {},
      sort: query.status === "played" ? ["-played_on"] : ["played_on"],
      limit: query.limit ?? -1,
    }),
  )) as Row[];
  return rows.map(toFixture);
}

/** Every match a team plays in a season, in date order, from its own side. */
export async function getTeamFixtures(teamSlug: string, seasonSlug?: string): Promise<TeamFixture[]> {
  const fixtures = await getFixtures({ team: teamSlug, season: seasonSlug });
  return fixtures.map((fixture) => toTeamFixture(fixture, teamSlug));
}

export async function getFixture(id: string): Promise<FixtureDetail | null> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_fixtures", {
      fields: FIXTURE_FIELDS as unknown as string[],
      filter: { id: { _eq: id } },
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return null;

  const [rubberRows, reportRows] = await Promise.all([
    client.request(
      readItems("hrc_rubbers", {
        fields: [
          "*",
          { home_player: ["full_name", "slug"] },
          { home_player_2: ["full_name", "slug"] },
          { away_player: ["full_name", "slug"] },
          { away_player_2: ["full_name", "slug"] },
        ],
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

/**
 * The league table for a season.
 *
 * Computed from the results, not stored — which is the point of entering
 * results at all. A card goes in, the table moves. A stored table is a
 * second copy of the same facts, and a second copy is a copy that drifts.
 *
 * The league's own scoring, read off its 2025 final tables: **points are
 * rubbers won**, not two-for-a-win. Water Lane A finished the Premier
 * Division on 118 points from 14 matches, and a match is ten rubbers —
 * which only makes sense if every rubber is a point. `played` is matches
 * played, and wins matter only for separating equal totals.
 *
 * Seasons the league archived before this site existed have a final table
 * and no match cards behind it. Those rows still live in `hrc_standings`,
 * and are used when a season has no results to compute from.
 */
export async function getStandings(seasonSlug?: string, division?: string): Promise<Standing[]> {
  const computed = await computeStandings(seasonSlug);
  const rows = computed.length > 0 ? computed : await getStoredStandings(seasonSlug);
  return division ? rows.filter((row) => row.division === division) : rows;
}

/** The archived tables, for seasons whose matches were never entered here. */
async function getStoredStandings(seasonSlug?: string): Promise<Standing[]> {
  const client = await directus();
  const seasonId = await seasonIdFor(seasonSlug);
  const filter: Record<string, unknown>[] = [];
  if (seasonId) filter.push({ season: { _eq: seasonId } });

  const rows = (await client.request(
    readItems("hrc_standings", {
      fields: ["*", { team: ["name", "slug"] }, { season: ["completion"] }],
      filter: filter.length ? { _and: filter } : {},
      sort: ["division", "position"],
      limit: -1,
    }),
  )) as Row[];
  return rows.map(toStanding);
}

interface TableRow {
  team: TeamRef;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
  /** Rubbers won against each other team, for the rule 20 tie-break. */
  against: Map<string, number>;
}

function blankRow(team: TeamRef): TableRow {
  return {
    team,
    played: 0,
    won: 0,
    drawn: 0,
    lost: 0,
    setsFor: 0,
    setsAgainst: 0,
    points: 0,
    against: new Map(),
  };
}

/**
 * Handbook rule 20, as the league states it on its own tables page:
 *
 *   "...the team which has won the most matches will be placed higher.
 *   Should this method not be decisive, the league position will be based
 *   on the results of the games between the relevant teams..."
 *
 * So: points, then matches won, then rubbers won in the meetings between
 * the two teams. A pair still level after all three is left in name order,
 * which is at least stable — the alternative is a table whose rows move
 * about between requests.
 */
function compareRows(a: TableRow, b: TableRow): number {
  if (b.points !== a.points) return b.points - a.points;
  if (b.won !== a.won) return b.won - a.won;

  const aHead = a.against.get(b.team.slug) ?? 0;
  const bHead = b.against.get(a.team.slug) ?? 0;
  if (aHead !== bHead) return bHead - aHead;

  return a.team.name.localeCompare(b.team.name);
}

async function computeStandings(seasonSlug?: string): Promise<Standing[]> {
  const [fixtures, teams, homeClub] = await Promise.all([
    getFixtures({ season: seasonSlug, competition: "league" }),
    getAllTeams(seasonSlug),
    getHomeClub(),
  ]);

  if (fixtures.length === 0) return [];

  return buildTable(
    fixtures,
    teams.map((team) => ({ name: team.name, slug: team.slug, division: team.division })),
    new Set(
      homeClub ? teams.filter((team) => team.clubSlug === homeClub.slug).map((team) => team.slug) : [],
    ),
  );
}

/**
 * The table itself, as a function of the results and nothing else.
 *
 * Separated from the fetching so the scoring and the tie-break can be
 * tested against known fixtures rather than against whatever happens to be
 * in Directus — and so that verifying "a result moves the table" does not
 * mean writing invented results into the league's live data.
 */
export function buildTable(
  fixtures: Fixture[],
  teams: TeamRef[],
  homeClubTeams: ReadonlySet<string> = new Set(),
): Standing[] {
  /*
   * Every team in the division appears, whether or not it has played —
   * a table that lists only the teams with results is not a table, and at
   * the start of a season it would be empty. The league's own opening
   * tables list all eight or nine teams on nought points.
   */
  const rows = new Map<string, TableRow>();
  for (const team of teams) rows.set(team.slug, blankRow(team));

  for (const fixture of fixtures) {
    if (fixture.status !== "played") continue;
    if (fixture.homeScore === null || fixture.awayScore === null) continue;

    for (const [side, opponent, score, opponentScore] of [
      [fixture.homeTeam, fixture.awayTeam, fixture.homeScore, fixture.awayScore],
      [fixture.awayTeam, fixture.homeTeam, fixture.awayScore, fixture.homeScore],
    ] as const) {
      // A fixture naming a team that is not in the season's team list —
      // a withdrawn side, say — still counts for its opponent.
      const row = rows.get(side.slug) ?? blankRow(side);
      rows.set(side.slug, row);

      row.played += 1;
      row.points += score;
      row.setsFor += score;
      row.setsAgainst += opponentScore;
      if (score > opponentScore) row.won += 1;
      else if (score < opponentScore) row.lost += 1;
      else row.drawn += 1;
      row.against.set(opponent.slug, (row.against.get(opponent.slug) ?? 0) + score);
    }
  }

  const byDivision = new Map<string, TableRow[]>();
  for (const row of rows.values()) {
    const division = row.team.division;
    if (!division) continue;
    byDivision.set(division, [...(byDivision.get(division) ?? []), row]);
  }

  const standings: Standing[] = [];
  for (const [division, divisionRows] of byDivision) {
    divisionRows.sort(compareRows);
    divisionRows.forEach((row, index) => {
      standings.push({
        // Stable across requests, and distinct across divisions, without a
        // stored row to take an id from.
        id: `${division}-${row.team.slug}`,
        division: division as Division,
        position: index + 1,
        teamName: row.team.name,
        teamSlug: row.team.slug,
        isHrc: homeClubTeams.has(row.team.slug),
        played: row.played,
        won: row.won,
        drawn: row.drawn,
        lost: row.lost,
        setsFor: row.setsFor,
        setsAgainst: row.setsAgainst,
        points: row.points,
        // A computed table is built from this season's own results, so
        // whatever the season turns out to be, it is being played.
        seasonIncomplete: null,
        lastSyncedAt: null,
      });
    });
  }

  // The league's own hierarchy, so the page never opens on Division 2.
  const order = new Map(DIVISION.map((division, index) => [division as string, index]));
  standings.sort(
    (a, b) => (order.get(a.division) ?? 99) - (order.get(b.division) ?? 99) || a.position - b.position,
  );
  return standings;
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
    rubbers: await getMemberRubbers(memberId),
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

// ---------------------------------------------------------------------------
// Scorecards
// ---------------------------------------------------------------------------

/** The two squads for a fixture, which is what a card's names are matched against. */
export async function getFixtureSquads(fixtureId: string): Promise<{
  fixture: Fixture | null;
  homeSquad: MemberSummary[];
  awaySquad: MemberSummary[];
}> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_fixtures", {
      /*
       * Its own projection rather than FIXTURE_FIELDS, which deliberately
       * fetches only what a fixture list renders and so carries no team
       * ids. Reusing it here silently produced two empty squads — every
       * name on every card unmatched, with nothing raised anywhere.
       */
      fields: [
        "*",
        { home_team: ["id", "name", "slug", "division"] },
        { away_team: ["id", "name", "slug", "division"] },
        { venue: ["name"] },
        { season: ["id"] },
      ] as unknown as string[],
      filter: { id: { _eq: fixtureId } },
      limit: 1,
    }),
  )) as Row[];
  if (!rows[0]) return { fixture: null, homeSquad: [], awaySquad: [] };

  const fixture = toFixture(rows[0]);
  const seasonId = rel(rows[0].season)?.id ?? null;
  const [home, away] = await Promise.all([
    squadFor(client, rel(rows[0].home_team)?.id, seasonId),
    squadFor(client, rel(rows[0].away_team)?.id, seasonId),
  ]);
  return { fixture, homeSquad: home, awaySquad: away };
}

async function squadFor(
  client: Awaited<ReturnType<typeof directus>>,
  teamId: unknown,
  seasonId: string | null,
): Promise<MemberSummary[]> {
  if (!teamId) return [];
  const filter: Record<string, unknown>[] = [{ team: { _eq: teamId as string } }];
  // A team's squad is per season; without this a card from 2026-27 would
  // be matched against everyone who has ever played for the club.
  if (seasonId) filter.push({ season: { _eq: seasonId } });

  const rows = (await client.request(
    readItems("hrc_squads", {
      fields: [{ member: MEMBER_PUBLIC_FIELDS as unknown as string[] }],
      filter: { _and: filter },
      limit: -1,
    }),
  )) as Row[];
  return rows
    .map((row) => rel(row.member))
    .filter((member): member is Row => member !== null)
    .map(toMemberSummary);
}

/**
 * Saves a card onto its fixture, replacing whatever was there.
 *
 * Wholesale rather than row-by-row: a corrected card is a new card, and
 * reconciling ten rubbers against ten rubbers would leave a half-updated
 * match on any failure — a worse state than either the old card or the
 * new one. The fixture's score is **derived from the games** here rather
 * than accepted from the caller, so the number on `/results` and the rows
 * on the card can never disagree.
 */
export async function saveScorecard(input: {
  fixtureId: string;
  playedOn: string | null;
  rubbers: Array<{
    rubberNumber: number;
    kind: string;
    homePlayerId: string | null;
    homePlayer2Id: string | null;
    awayPlayerId: string | null;
    awayPlayer2Id: string | null;
    homePlayerName: string | null;
    awayPlayerName: string | null;
    games: Array<[number, number]>;
  }>;
}): Promise<{ homeScore: number; awayScore: number; rubbers: number }> {
  const client = await directus();

  const existing = (await client.request(
    readItems("hrc_rubbers", {
      fields: ["id"],
      filter: { fixture: { _eq: input.fixtureId } },
      limit: -1,
    }),
  )) as Row[];
  if (existing.length > 0) {
    await client.request(deleteItems("hrc_rubbers", existing.map((row) => row.id)));
  }

  const rows = input.rubbers.map((rubber) => {
    const { homeSets, awaySets } = outcomeOf(rubber.games);
    return {
      fixture: input.fixtureId,
      rubber_number: rubber.rubberNumber,
      kind: rubber.kind === "doubles" ? "doubles" : "singles",
      home_player: rubber.homePlayerId,
      home_player_2: rubber.homePlayer2Id,
      away_player: rubber.awayPlayerId,
      away_player_2: rubber.awayPlayer2Id,
      // Only kept where no member matched; a name beside a relation is
      // two sources for one fact.
      home_player_name: rubber.homePlayerId ? null : rubber.homePlayerName,
      away_player_name: rubber.awayPlayerId ? null : rubber.awayPlayerName,
      home_sets: homeSets,
      away_sets: awaySets,
      games: rubber.games,
    };
  });

  if (rows.length > 0) {
    await client.request(createItems("hrc_rubbers", rows as never));
  }

  const score = matchScoreOf(input.rubbers);
  await client.request(
    updateItem("hrc_fixtures", input.fixtureId, {
      status: "played",
      home_score: score.home,
      away_score: score.away,
      ...(input.playedOn ? { played_on: input.playedOn } : {}),
    }),
  );

  return { homeScore: score.home, awayScore: score.away, rubbers: rows.length };
}

/** Records an upload and what came of it, so a bad parse can be traced later. */
export async function recordScorecardUpload(input: {
  fixtureId: string | null;
  status: string;
  parsed?: unknown;
  warnings?: unknown;
  error?: string | null;
  model?: string | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
}): Promise<{ id: string }> {
  const client = await directus();
  const created = (await client.request(
    createItem("hrc_scorecards", {
      fixture: input.fixtureId,
      status: input.status,
      parsed: input.parsed ?? null,
      warnings: input.warnings ?? null,
      error: input.error ?? null,
      model: input.model ?? null,
      input_tokens: input.inputTokens ?? null,
      output_tokens: input.outputTokens ?? null,
      parsed_at: new Date().toISOString(),
    }),
  )) as Row;
  return { id: created?.id ?? "" };
}

/**
 * Every rubber a player has played, from their own side.
 *
 * Four relations can point at one member — home, home partner, away, away
 * partner — so this is four filters OR'd together rather than one, and
 * which one matched decides how the row is turned round. Getting that
 * wrong would show a player's wins as losses on their own profile, which
 * is the sort of thing nobody reports and everybody notices.
 */
export async function getMemberRubbers(memberId: string): Promise<PlayerRubber[]> {
  const client = await directus();
  const rows = (await client.request(
    readItems("hrc_rubbers", {
      fields: [
        "*",
        { home_player: ["id", "full_name", "slug"] },
        { home_player_2: ["id", "full_name", "slug"] },
        { away_player: ["id", "full_name", "slug"] },
        { away_player_2: ["id", "full_name", "slug"] },
        { fixture: ["id", "played_on", "status", { home_team: ["name", "slug", "division"] }, { away_team: ["name", "slug", "division"] }] },
      ] as unknown as string[],
      filter: {
        _or: [
          { home_player: { _eq: memberId } },
          { home_player_2: { _eq: memberId } },
          { away_player: { _eq: memberId } },
          { away_player_2: { _eq: memberId } },
        ],
      },
      limit: -1,
    }),
  )) as Row[];

  const played: PlayerRubber[] = [];
  for (const row of rows) {
    const fixture = rel(row.fixture);
    if (!fixture) continue;

    const isHome =
      rel(row.home_player)?.id === memberId || rel(row.home_player_2)?.id === memberId;

    const ownSide = isHome
      ? [rel(row.home_player), rel(row.home_player_2)]
      : [rel(row.away_player), rel(row.away_player_2)];
    const otherSide = isHome
      ? [rel(row.away_player), rel(row.away_player_2)]
      : [rel(row.home_player), rel(row.home_player_2)];

    const partnerRow = ownSide.find((member) => member && member.id !== memberId) ?? null;
    const setsFor = isHome ? int(row.home_sets) : int(row.away_sets);
    const setsAgainst = isHome ? int(row.away_sets) : int(row.home_sets);
    const games = (Array.isArray(row.games) ? (row.games as Array<[number, number]>) : []).map(
      // Turned round for an away player, so "11-8" always means they won it.
      ([home, away]) => (isHome ? [home, away] : [away, home]) as [number, number],
    );

    played.push({
      fixtureId: fixture.id,
      playedOn: str(fixture.played_on),
      team: toTeamRef(isHome ? rel(fixture.home_team) : rel(fixture.away_team)),
      opponentTeam: toTeamRef(isHome ? rel(fixture.away_team) : rel(fixture.home_team)),
      isHome,
      rubberNumber: int(row.rubber_number),
      kind: row.kind === "doubles" ? "doubles" : "singles",
      partner: partnerRow ? { name: partnerRow.full_name ?? "", slug: partnerRow.slug ?? null } : null,
      opponents: otherSide
        .filter((member): member is Row => member !== null)
        .map((member) => ({ name: member.full_name ?? "", slug: member.slug ?? null }))
        .concat(
          // The opposition are often names on a card rather than members.
          otherSide.every((member) => member === null)
            ? [{ name: str(isHome ? row.away_player_name : row.home_player_name) ?? "", slug: null }].filter(
                (player) => player.name,
              )
            : [],
        ),
      setsFor,
      setsAgainst,
      won: setsFor > setsAgainst,
      games,
    });
  }

  return played.sort((a, b) => {
    const byDate = (b.playedOn ?? "").localeCompare(a.playedOn ?? "");
    return byDate !== 0 ? byDate : a.rubberNumber - b.rubberNumber;
  });
}
