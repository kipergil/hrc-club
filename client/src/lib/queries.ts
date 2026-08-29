import { QueryClient, useQuery, type UseQueryResult } from "@tanstack/react-query";
import { apiGet } from "@shared/api-client.js";
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
  Season,
  SiteSettings,
  Standing,
  Team,
  TeamDetail,
  Venue,
} from "@shared/types.js";

/**
 * A long `staleTime` on purpose. The API responses are already CDN-cached
 * with `stale-while-revalidate`, and every Tier A/B page arrives
 * prerendered with its data embedded — so refetching on every mount would
 * spend a reader's data allowance to re-fetch bytes that have not changed.
 * Content that does change fast enough to matter (results on a match night)
 * is covered by the ten-minute CDN TTL.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 5 * 60_000,
        gcTime: 30 * 60_000,
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  });
}

/**
 * Query keys double as prerender instructions: `scripts/prerender.tsx`
 * prefetches exactly these, so a key defined here and used in a component
 * cannot be missed by the prerenderer.
 */
export const keys = {
  home: ["home"] as const,
  settings: ["settings"] as const,
  seasons: ["seasons"] as const,
  clubs: ["clubs"] as const,
  club: (slug: string) => ["club", slug] as const,
  page: (slug: string) => ["page", slug] as const,
  sessions: ["sessions"] as const,
  venues: ["venues"] as const,
  venue: (slug: string) => ["venue", slug] as const,
  teams: (season?: string) => ["teams", season ?? "current"] as const,
  team: (slug: string) => ["team", slug] as const,
  fixtures: (query: string) => ["fixtures", query] as const,
  fixture: (id: string) => ["fixture", id] as const,
  standings: (season?: string) => ["standings", season ?? "current"] as const,
  averages: (season?: string) => ["averages", season ?? "current"] as const,
  players: ["players"] as const,
  player: (slug: string) => ["player", slug] as const,
  news: (category?: string) => ["news", category ?? "all"] as const,
  newsItem: (slug: string) => ["news-item", slug] as const,
  events: ["events"] as const,
  event: (slug: string) => ["event", slug] as const,
  gallery: ["gallery"] as const,
  album: (slug: string) => ["album", slug] as const,
  documents: ["documents"] as const,
  honours: ["honours"] as const,
  committee: ["committee"] as const,
  links: ["links"] as const,
  faqs: ["faqs"] as const,
};

export const fetchers = {
  home: () => apiGet<HomePayload>("/api/home"),
  settings: () => apiGet<SiteSettings>("/api/settings"),
  seasons: () => apiGet<Season[]>("/api/seasons"),
  clubs: () => apiGet<Club[]>("/api/clubs"),
  club: (slug: string) => apiGet<ClubDetail>(`/api/clubs/${slug}`),
  page: (slug: string) => apiGet<Page>(`/api/pages/${slug}`),
  sessions: () => apiGet<ClubSession[]>("/api/sessions"),
  venues: () => apiGet<Venue[]>("/api/venues"),
  venue: (slug: string) => apiGet<Venue>(`/api/venues/${slug}`),
  teams: (season?: string) => apiGet<Team[]>(`/api/teams${season ? `?season=${season}` : ""}`),
  team: (slug: string) => apiGet<TeamDetail>(`/api/teams/${slug}`),
  fixtures: (query: string) => apiGet<Fixture[]>(`/api/fixtures${query ? `?${query}` : ""}`),
  fixture: (id: string) => apiGet<FixtureDetail>(`/api/fixtures/${id}`),
  standings: (season?: string) => apiGet<Standing[]>(`/api/standings${season ? `?season=${season}` : ""}`),
  averages: (season?: string) => apiGet<PlayerStat[]>(`/api/averages${season ? `?season=${season}` : ""}`),
  players: () => apiGet<MemberSummary[]>("/api/players"),
  player: (slug: string) => apiGet<MemberProfile>(`/api/players/${slug}`),
  news: (category?: string) => apiGet<NewsItem[]>(`/api/news${category ? `?category=${category}` : ""}`),
  newsItem: (slug: string) => apiGet<NewsItem>(`/api/news/${slug}`),
  events: () => apiGet<ClubEvent[]>("/api/events"),
  event: (slug: string) => apiGet<ClubEvent>(`/api/events/${slug}`),
  gallery: () => apiGet<GalleryAlbum[]>("/api/gallery"),
  album: (slug: string) => apiGet<GalleryAlbumDetail>(`/api/gallery/${slug}`),
  documents: () => apiGet<ClubDocument[]>("/api/documents"),
  honours: () => apiGet<Honour[]>("/api/honours"),
  committee: () => apiGet<CommitteeRole[]>("/api/committee"),
  links: () => apiGet<ExternalLink[]>("/api/links"),
  faqs: () => apiGet<Faq[]>("/api/faqs"),
};

export const useHome = (): UseQueryResult<HomePayload> =>
  useQuery({ queryKey: keys.home, queryFn: fetchers.home });
export const useSettings = (): UseQueryResult<SiteSettings> =>
  useQuery({ queryKey: keys.settings, queryFn: fetchers.settings });
export const useClubs = (): UseQueryResult<Club[]> =>
  useQuery({ queryKey: keys.clubs, queryFn: fetchers.clubs });
export const useClub = (slug: string): UseQueryResult<ClubDetail> =>
  useQuery({ queryKey: keys.club(slug), queryFn: () => fetchers.club(slug) });
export const usePage = (slug: string): UseQueryResult<Page> =>
  useQuery({ queryKey: keys.page(slug), queryFn: () => fetchers.page(slug) });
export const useSessions = (): UseQueryResult<ClubSession[]> =>
  useQuery({ queryKey: keys.sessions, queryFn: fetchers.sessions });
export const useVenues = (): UseQueryResult<Venue[]> =>
  useQuery({ queryKey: keys.venues, queryFn: fetchers.venues });
export const useVenue = (slug: string): UseQueryResult<Venue> =>
  useQuery({ queryKey: keys.venue(slug), queryFn: () => fetchers.venue(slug) });
export const useTeams = (season?: string): UseQueryResult<Team[]> =>
  useQuery({ queryKey: keys.teams(season), queryFn: () => fetchers.teams(season) });
export const useTeam = (slug: string): UseQueryResult<TeamDetail> =>
  useQuery({ queryKey: keys.team(slug), queryFn: () => fetchers.team(slug) });
export const useFixtures = (query: string): UseQueryResult<Fixture[]> =>
  useQuery({ queryKey: keys.fixtures(query), queryFn: () => fetchers.fixtures(query) });
export const useFixture = (id: string): UseQueryResult<FixtureDetail> =>
  useQuery({ queryKey: keys.fixture(id), queryFn: () => fetchers.fixture(id) });
export const useStandings = (season?: string): UseQueryResult<Standing[]> =>
  useQuery({ queryKey: keys.standings(season), queryFn: () => fetchers.standings(season) });
export const useAverages = (season?: string): UseQueryResult<PlayerStat[]> =>
  useQuery({ queryKey: keys.averages(season), queryFn: () => fetchers.averages(season) });
export const usePlayers = (): UseQueryResult<MemberSummary[]> =>
  useQuery({ queryKey: keys.players, queryFn: fetchers.players });
export const usePlayer = (slug: string): UseQueryResult<MemberProfile> =>
  useQuery({ queryKey: keys.player(slug), queryFn: () => fetchers.player(slug) });
export const useNews = (category?: string): UseQueryResult<NewsItem[]> =>
  useQuery({ queryKey: keys.news(category), queryFn: () => fetchers.news(category) });
export const useNewsItem = (slug: string): UseQueryResult<NewsItem> =>
  useQuery({ queryKey: keys.newsItem(slug), queryFn: () => fetchers.newsItem(slug) });
export const useEvents = (): UseQueryResult<ClubEvent[]> =>
  useQuery({ queryKey: keys.events, queryFn: fetchers.events });
export const useEvent = (slug: string): UseQueryResult<ClubEvent> =>
  useQuery({ queryKey: keys.event(slug), queryFn: () => fetchers.event(slug) });
export const useGallery = (): UseQueryResult<GalleryAlbum[]> =>
  useQuery({ queryKey: keys.gallery, queryFn: fetchers.gallery });
export const useAlbum = (slug: string): UseQueryResult<GalleryAlbumDetail> =>
  useQuery({ queryKey: keys.album(slug), queryFn: () => fetchers.album(slug) });
export const useDocuments = (): UseQueryResult<ClubDocument[]> =>
  useQuery({ queryKey: keys.documents, queryFn: fetchers.documents });
export const useHonours = (): UseQueryResult<Honour[]> =>
  useQuery({ queryKey: keys.honours, queryFn: fetchers.honours });
export const useCommittee = (): UseQueryResult<CommitteeRole[]> =>
  useQuery({ queryKey: keys.committee, queryFn: fetchers.committee });
export const useLinks = (): UseQueryResult<ExternalLink[]> =>
  useQuery({ queryKey: keys.links, queryFn: fetchers.links });
export const useFaqs = (): UseQueryResult<Faq[]> =>
  useQuery({ queryKey: keys.faqs, queryFn: fetchers.faqs });
