import { Route, Switch } from "wouter";
import { Layout } from "@/components/layout";
import HomePage from "@/pages/home";
import NotFoundPage from "@/pages/not-found";
import {
  AboutPage,
  AccessibilityPage,
  CoachingPage,
  HistoryPage,
  JuniorsPage,
  PrivacyPage,
  SafeguardingPage,
} from "@/pages/content";
import { JoinPage, PlayPage, VenuePage } from "@/pages/play";
import { PlayerPage, PlayersPage, TeamPage, TeamsPage } from "@/pages/teams";
import { ClubPage, ClubsPage } from "@/pages/clubs";
import {
  AveragesPage,
  CupsPage,
  FixturesPage,
  HandicapsPage,
  MatchPage,
  ResultsPage,
  TablesPage,
} from "@/pages/matches";
import {
  AlbumPage,
  EventPage,
  EventsPage,
  GalleryPage,
  NewsItemPage,
  NewsPage,
  NewslettersPage,
} from "@/pages/news";
import {
  CommitteePage,
  DocumentsPage,
  HelpPage,
  HonoursPage,
  LinksPage,
  SponsorsPage,
} from "@/pages/about";
import { ContactPage } from "@/pages/contact";

/**
 * Route order matters in wouter's `Switch`: the first match wins. The
 * static paths are therefore listed before the parameterised ones they
 * would otherwise be swallowed by — `/news` before `/news/:slug`.
 */
export default function App() {
  return (
    <Layout>
      <Switch>
        <Route path="/" component={HomePage} />

        {/* Play */}
        <Route path="/play" component={PlayPage} />
        <Route path="/play/venue/:slug">{(params) => <VenuePage slug={params.slug} />}</Route>
        <Route path="/join" component={JoinPage} />
        <Route path="/coaching" component={CoachingPage} />
        <Route path="/juniors" component={JuniorsPage} />

        {/* Teams and competition */}
        <Route path="/clubs" component={ClubsPage} />
        <Route path="/clubs/:slug">{(params) => <ClubPage slug={params.slug} />}</Route>
        <Route path="/teams" component={TeamsPage} />
        <Route path="/teams/:slug">{(params) => <TeamPage slug={params.slug} />}</Route>
        <Route path="/fixtures" component={FixturesPage} />
        <Route path="/results" component={ResultsPage} />
        <Route path="/results/:id">{(params) => <MatchPage id={params.id} />}</Route>
        <Route path="/tables" component={TablesPage} />
        <Route path="/averages" component={AveragesPage} />
        <Route path="/handicaps" component={HandicapsPage} />
        <Route path="/cups" component={CupsPage} />
        <Route path="/players" component={PlayersPage} />
        <Route path="/players/:slug">{(params) => <PlayerPage slug={params.slug} />}</Route>

        {/* News and media */}
        <Route path="/news" component={NewsPage} />
        <Route path="/newsletters" component={NewslettersPage} />
        <Route path="/news/:slug">{(params) => <NewsItemPage slug={params.slug} />}</Route>
        <Route path="/events" component={EventsPage} />
        <Route path="/events/:slug">{(params) => <EventPage slug={params.slug} />}</Route>
        <Route path="/gallery" component={GalleryPage} />
        <Route path="/gallery/:slug">{(params) => <AlbumPage slug={params.slug} />}</Route>

        {/* About the club */}
        <Route path="/about" component={AboutPage} />
        <Route path="/about/history" component={HistoryPage} />
        <Route path="/committee" component={CommitteePage} />
        <Route path="/honours" component={HonoursPage} />
        <Route path="/documents" component={DocumentsPage} />
        <Route path="/links" component={LinksPage} />
        <Route path="/sponsors" component={SponsorsPage} />
        <Route path="/help" component={HelpPage} />
        <Route path="/contact" component={ContactPage} />

        {/* Policies — reachable by direct link and from the footer, not in the menu */}
        <Route path="/privacy" component={PrivacyPage} />
        <Route path="/accessibility" component={AccessibilityPage} />
        <Route path="/safeguarding" component={SafeguardingPage} />

        <Route component={NotFoundPage} />
      </Switch>
    </Layout>
  );
}
