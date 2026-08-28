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
}

export interface SquadPlace {
  id: string;
  role: string;
  member: MemberSummary;
}

export interface TeamDetail extends Team {
  squad: SquadPlace[];
  fixtures: Fixture[];
  results: Fixture[];
  standing: Standing | null;
}

export interface Fixture {
  id: string;
  playedOn: string | null;
  startTime: string | null;
  weekCommencing: string | null;
  competition: Competition;
  opponentName: string;
  isHome: boolean;
  status: FixtureStatus;
  result: FixtureResult | null;
  hrcScore: number | null;
  opponentScore: number | null;
  scorecardUrl: string | null;
  teamName: string;
  teamSlug: string;
  venueName: string | null;
  lastSyncedAt: string | null;
}

export interface Rubber {
  id: string;
  rubberNumber: number;
  memberName: string | null;
  memberSlug: string | null;
  opponentPlayerName: string | null;
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
  isHrc: boolean;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  setsFor: number;
  setsAgainst: number;
  points: number;
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
}

export interface Honour {
  id: string;
  title: string;
  honourType: string;
  competition: Competition | null;
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
}
