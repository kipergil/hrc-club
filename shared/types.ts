/**
 * The read models the API returns and the client consumes.
 *
 * These are deliberately not the Directus row shapes. Directus returns
 * every column it is permitted to, with relations either as ids or as
 * nested objects depending on the `fields` query; the client should not
 * have to know which. `server/storage.ts` maps one to the other in exactly
 * one place, so a schema change shows up as a compile error there rather
 * than as an undefined somewhere in a component.
 */
import type {
  Competition,
  DayOfWeek,
  Division,
  DocumentCategory,
  FixtureResult,
  FixtureStatus,
  MembershipPeriod,
  NewsCategory,
  SessionType,
  SponsorTier,
} from "./enums.js";

export interface SiteSettings {
  clubName: string;
  shortName: string | null;
  strapline: string | null;
  foundedYear: number | null;
  aboutSummary: string | null;
  contactEmail: string | null;
  phone: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  leagueUrl: string | null;
  logoId: string | null;
  crestId: string | null;
  /** Null once `announcement_expires_at` has passed — the banner takes itself down. */
  announcement: string | null;
  currentSeason: Season | null;
}

export interface Season {
  id: string;
  label: string;
  slug: string;
  startsOn: string | null;
  endsOn: string | null;
  isCurrent: boolean;
}

export interface Page {
  id: string;
  title: string;
  subtitle: string | null;
  slug: string;
  body: string | null;
  heroImageId: string | null;
  seoDescription: string | null;
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface Venue {
  id: string;
  name: string;
  slug: string;
  addressLine1: string | null;
  addressLine2: string | null;
  town: string | null;
  postcode: string | null;
  mapUrl: string | null;
  /**
   * Null until the venue has been geocoded, and the map treats that as a
   * venue to list without a pin rather than as a reason to fail.
   */
  latitude: number | null;
  longitude: number | null;
  directions: string | null;
  parkingNotes: string | null;
  accessibilityNotes: string | null;
  tableCount: number | null;
  isHomeVenue: boolean;
  photoId: string | null;
}

export interface ClubSession {
  id: string;
  name: string;
  dayOfWeek: DayOfWeek;
  startTime: string | null;
  endTime: string | null;
  sessionType: SessionType;
  suitableFor: string | null;
  costNote: string | null;
  notes: string | null;
  venue: Venue | null;
  leadCoachName: string | null;
}

export interface MemberSummary {
  id: string;
  fullName: string;
  displayName: string | null;
  slug: string;
  photoId: string | null;
  isCoach: boolean;
  isCommittee: boolean;
}

export interface MemberProfile extends MemberSummary {
  bio: string | null;
  joinedYear: number | null;
  status: string;
  stats: PlayerStat[];
  squadPlaces: Array<{ teamName: string; teamSlug: string; seasonLabel: string; role: string }>;
  honours: Honour[];
}

export interface Club {
  id: string;
  name: string;
  slug: string;
  shortName: string | null;
  isHomeClub: boolean;
  description: string | null;
  website: string | null;
  logoId: string | null;
  venue: Venue | null;
  teamCount: number;
  playerCount: number;
  divisions: Division[];
}

export interface ClubDetail extends Club {
  teams: Team[];
  squads: Array<{ teamName: string; teamSlug: string; players: MemberSummary[] }>;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  division: Division;
  homeNight: DayOfWeek | null;
  homeStartTime: string | null;
  description: string | null;
  teamPhotoId: string | null;
  captain: MemberSummary | null;
  homeVenue: Venue | null;
  seasonLabel: string;
  clubName: string | null;
  clubSlug: string | null;
}

export interface SquadPlace {
  id: string;
  role: string;
  member: MemberSummary;
}

export interface TeamDetail extends Team {
  squad: SquadPlace[];
  fixtures: TeamFixture[];
  results: TeamFixture[];
  standing: Standing | null;
}

/** One side of a match, as the site refers to a team everywhere. */
export interface TeamRef {
  name: string;
  slug: string;
  /** Null for an archived row naming a team the site no longer holds. */
  division: Division | null;
}

/**
 * A league match: two of the league's own teams, and the rubbers each won.
 *
 * This was shaped for one club's site — a single `team`, an
 * `opponentName` string, and `hrcScore`/`opponentScore`. On the league's
 * own site there is no "us": a match belongs to two teams that each have a
 * page and a table row, and entering it once has to serve both.
 */
export interface Fixture {
  id: string;
  playedOn: string | null;
  startTime: string | null;
  weekCommencing: string | null;
  competition: Competition;
  status: FixtureStatus;
  homeTeam: TeamRef;
  awayTeam: TeamRef;
  /** Rubbers won. Null until the card is confirmed. */
  homeScore: number | null;
  awayScore: number | null;
  scorecardUrl: string | null;
  venueName: string | null;
  lastSyncedAt: string | null;
}

/**
 * A fixture seen from one team's side — what a team's own match list needs.
 *
 * `result` and the score order depend on which team is asking, so they are
 * computed per view rather than stored: the same row is a win for one team
 * and a loss for the other.
 */
export interface TeamFixture extends Fixture {
  isHome: boolean;
  opponent: TeamRef;
  /** This team's rubbers, then the opposition's. */
  teamScore: number | null;
  opponentScore: number | null;
  result: FixtureResult | null;
}

export interface Rubber {
  id: string;
  rubberNumber: number;
  /** The player, or the pair, on `memberIsHome`'s side. */
  memberName: string | null;
  memberSlug: string | null;
  opponentPlayerName: string | null;
  /**
   * Which side `memberName` played for.
   *
   * A rubber row records one side and measures everything from it, so
   * `setsFor` and `won` mean nothing until you know whose they are. The
   * card is laid out in home and away columns to match the scoreline, and
   * this is what decides which column a name goes in.
   */
  memberIsHome: boolean;
  setsFor: number;
  setsAgainst: number;
  won: boolean;
  scoreDetail: string | null;
}

export interface FixtureDetail extends Fixture {
  report: string | null;
  reportImageId: string | null;
  rubbers: Rubber[];
  linkedReport: { title: string; slug: string } | null;
}

export interface Standing {
  id: string;
  division: Division;
  position: number;
  teamName: string;
  /** Set when the row is for a team the site still holds, so it can link. */
  teamSlug: string | null;
  isHrc: boolean;
  played: number;
  /*
   * Null where the table is an archived one.
   *
   * The league's own closing tables, back to 2011-12, publish three
   * columns: team, played, points. Nothing records how those points were
   * split into wins and losses, and defaulting the difference to zero
   * would print "0 wins" beside a team that won the division on 118
   * points. Null is the honest answer, and `StandingsTable` drops a column
   * that is null the whole way down rather than showing a column of
   * dashes.
   */
  won: number | null;
  drawn: number | null;
  lost: number | null;
  setsFor: number | null;
  setsAgainst: number | null;
  points: number;
  /**
   * Set when the league did not complete the season — 2019-20 was
   * abandoned in March 2020, 2020-21 cancelled outright. A snapshot taken
   * when play stopped is not a final table and should not be read as one.
   */
  seasonIncomplete: "abandoned" | "cancelled" | null;
  lastSyncedAt: string | null;
}

export interface PlayerStat {
  id: string;
  memberName: string;
  memberSlug: string;
  seasonLabel: string;
  teamName: string | null;
  division: Division | null;
  played: number;
  won: number;
  lost: number;
  winPercentage: number | null;
  handicap: number | null;
  meetsParticipationThreshold: boolean;
}

export interface NewsItem {
  id: string;
  title: string;
  slug: string;
  summary: string | null;
  body: string | null;
  category: NewsCategory;
  isPinned: boolean;
  publishedAt: string | null;
  heroImageId: string | null;
  attachmentId: string | null;
  authorName: string | null;
  fixtureId: string | null;
}

export interface ClubEvent {
  id: string;
  title: string;
  slug: string;
  startsAt: string | null;
  endsAt: string | null;
  description: string | null;
  status: string;
  isMembersOnly: boolean;
  entryUrl: string | null;
  costNote: string | null;
  heroImageId: string | null;
  venueName: string | null;
}

export interface GalleryAlbum {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  takenOn: string | null;
  coverImageId: string | null;
  itemCount: number;
}

export interface GalleryAlbumDetail extends GalleryAlbum {
  items: Array<{ id: string; caption: string; imageId: string | null }>;
}

export interface ClubDocument {
  id: string;
  title: string;
  slug: string;
  category: DocumentCategory;
  description: string | null;
  documentDate: string | null;
  fileId: string | null;
  /** Where the file still lives, when there is no copy in Directus. */
  externalUrl: string | null;
}

export interface Honour {
  id: string;
  title: string;
  honourType: string;
  competition: Competition | null;
  /** The competition as the league writes it — see the field's note in the schema. */
  competitionName: string | null;
  seasonLabel: string;
  recipientName: string | null;
  notes: string | null;
  memberSlug: string | null;
  teamName: string | null;
  photoId: string | null;
}

export interface MembershipOption {
  id: string;
  name: string;
  pricePence: number;
  period: MembershipPeriod;
  includes: string | null;
}

export interface CommitteeRole {
  id: string;
  roleTitle: string;
  /** Who holds the post when they are not a registered player. */
  holderName: string | null;
  publicEmail: string | null;
  responsibilities: string | null;
  member: MemberSummary | null;
}

export interface Sponsor {
  id: string;
  name: string;
  url: string | null;
  tier: SponsorTier;
  description: string | null;
  logoId: string | null;
}

export interface ExternalLink {
  id: string;
  label: string;
  url: string;
  category: string | null;
  description: string | null;
}

export interface Faq {
  id: string;
  question: string;
  answer: string | null;
  category: string | null;
}

/** Everything the home page needs, in one request. */
export interface HomePayload {
  settings: SiteSettings;
  nextFixtures: Fixture[];
  latestResults: Fixture[];
  news: NewsItem[];
  events: ClubEvent[];
  sessions: ClubSession[];
  standings: Standing[];
  /** Counted from the data, never written down — see `getLeagueCounts`. */
  counts: {
    clubs: number;
    teams: number;
    divisions: number;
    /** The earliest year in the roll of honour, or null if there is none. */
    honoursFrom: number | null;
  };
}
