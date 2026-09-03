import { Link } from "wouter";
import { PageHeader, PrintButton } from "@/components/layout";
import {
  AveragesByDivision,
  FixtureList,
  HandicapTable,
  SeasonGrid,
  StandingsByDivision,
} from "@/components/data";
import {
  Badge,
  Card,
  Disclosure,
  Empty,
  ErrorNote,
  FilterChips,
  Loading,
  Pagination,
  Prose,
  TableNote,
  TableScroller,
  Td,
  Th,
  Tr,
  usePagination,
} from "@/components/ui";
import { useAverages, useFixture, useFixtures, useSeasons, useStandings } from "@/lib/queries";
import { SeasonPicker, useSeasonParam } from "@/components/season";
import { useUrlParam } from "@/lib/params";
import { teamModuleHref } from "@/lib/links";
import { cn, divisionLabel, formatDateLong, formatTime, resultLabel } from "@/lib/utils";
import { buildCalendar } from "@/lib/calendar";
import { Scorecard } from "@/components/scorecard";
import { COMPETITION_LABELS, DIVISION } from "@shared/enums.js";
import type { Division } from "@shared/enums.js";
import type { Fixture, TeamRef } from "@shared/types.js";
import { useMemo, useState } from "react";

/**
 * The note under every page that carries competitive data, saying where
 * it came from and when.
 *
 * It used to say results "come from the league's own records, where
 * captains enter them", which was true when this site only mirrored the
 * league. Cards are now entered here — that is what `/admin/scorecards`
 * is — so the sentence had become a polite untruth on every page it
 * appeared under. Being able to see where a number came from is the
 * difference between trusting it and not, which is the whole reason this
 * note exists; leaving it stale would have defeated the point of it.
 */
function SyncNote({ lastSyncedAt }: { lastSyncedAt: string | null | undefined }) {
  return (
    <p className="mt-8 border-t border-line pt-5 text-ink-muted">
      Results come from the match cards, entered by team captains after the match.
      {lastSyncedAt ? ` Last updated ${formatDateLong(lastSyncedAt)}.` : null}
    </p>
  );
}

// ---------------------------------------------------------------------------

/**
 * The season grid, division by division — the league's `Calendarz.asp`.
 *
 * A separate page rather than a toggle on `/fixtures` because it is a
 * thing people link to and print: "here is our season" is the message, and
 * an address that says which division and which year is worth having.
 *
 * One division at a time, as the league does it. Three divisions of eight
 * or nine teams across thirty-two weeks in a single grid would be a table
 * nobody could read on any screen.
 */
export function CalendarPage() {
  const [season, setSeason] = useSeasonParam();
  const { data: seasons } = useSeasons();
  const {
    data: fixtures,
    isLoading,
    isError,
  } = useFixtures(`competition=league${season ? `&season=${season}` : ""}`);

  const [division, setDivision] = useState<Division>("premier");

  // Which divisions the season actually ran. The league fielded two from
  // 2016-17 to 2018-19, and a chip for an empty division is a dead end.
  const divisions = useMemo(
    () =>
      DIVISION.filter((value) =>
        (fixtures ?? []).some(
          (fixture) =>
            fixture.homeTeam?.division === value || fixture.awayTeam?.division === value,
        ),
      ),
    [fixtures],
  );

  const shown = divisions.includes(division) ? division : divisions[0];

  const segments = useMemo(
    () =>
      buildCalendar(
        (fixtures ?? []).filter(
          (fixture) =>
            fixture.homeTeam?.division === shown || fixture.awayTeam?.division === shown,
        ),
      ),
    [fixtures, shown],
  );

  if (isLoading) return <Loading what="the fixture calendar" variant="table" />;
  if (isError) return <ErrorNote what="fixture calendar" />;

  return (
    <div>
      <PageHeader
        title="Season calendar"
        subtitle="Every team's whole season, week by week"
        actions={<PrintButton label="Print this calendar" />}
      >
        <div className="space-y-4">
          <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
          {divisions.length > 1 ? (
            <FilterChips
              label="Division"
              value={shown ?? "premier"}
              onChange={setDivision}
              options={divisions.map((value) => ({ value, label: divisionLabel(value) }))}
            />
          ) : null}
        </div>
      </PageHeader>

      <p className="mb-6 max-w-readable text-ink-muted">
        Each row is a team and each column a week. “v” is a home match and “at” is away; an empty
        week is one with no match in it.
      </p>

      <SeasonGrid segments={segments} />

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The banner shown when a list has been narrowed to one team.
 *
 * Filtering has to be visible, or a list that is missing four fifths of its
 * rows just looks broken. It names the team, offers the way out, and links
 * to the team's own page — which is where the team name used to go, and is
 * still one click away for anyone who wanted it.
 *
 * The name is taken from the rows rather than fetched: every row in a
 * filtered list has this team on one side of it, so a second request would
 * only re-learn what is already on screen.
 */
function TeamFilterNote({
  slug,
  fixtures,
  onClear,
}: {
  slug: string;
  fixtures: Fixture[] | undefined;
  onClear: () => void;
}) {
  const name = useMemo(() => {
    for (const fixture of fixtures ?? []) {
      if (fixture.homeTeam.slug === slug) return fixture.homeTeam.name;
      if (fixture.awayTeam.slug === slug) return fixture.awayTeam.name;
    }
    return null;
  }, [fixtures, slug]);

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-brand/30 bg-brand-soft px-4 py-3">
      <p>
        Showing only <strong>{name ?? slug}</strong>.
      </p>
      <Link href={`/teams/${slug}`} className="link">
        This team's page
      </Link>
      <button type="button" onClick={onClear} className="link font-semibold">
        Show every team
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function FixturesPage() {
  const [season, setSeason] = useSeasonParam();
  const [team, setTeam] = useUrlParam("team");
  const { data: seasons } = useSeasons();
  const {
    data: fixtures,
    isLoading,
    isError,
  } = useFixtures(
    `status=scheduled${season ? `&season=${season}` : ""}${team ? `&team=${encodeURIComponent(team)}` : ""}`,
  );

  /*
   * Grouped by the league's own week-commencing scheduling, because that
   * is how captains and players think about the season — "week of the
   * 12th", not "the 14th and the 16th".
   *
   * Every hook here runs before any early return. They did not:
   * `usePagination` sat below the loading and error guards, so the first
   * render (loading) called fewer hooks than the second (loaded) and
   * React tore the whole page down with "Rendered more hooks than during
   * the previous render" — no rows, no empty state, no message. It
   * survived only when prerendered data made the first render a loaded
   * one, which is exactly why the page failed *sometimes*: on a cold
   * client-side navigation and nowhere else.
   */
  const weeks = useMemo(() => {
    const grouped = new Map<string, Fixture[]>();
    for (const fixture of fixtures ?? []) {
      const key = fixture.weekCommencing ?? fixture.playedOn ?? "unscheduled";
      grouped.set(key, [...(grouped.get(key) ?? []), fixture]);
    }
    return [...grouped.entries()];
  }, [fixtures]);

  /*
   * Paginated by week rather than by match, so a page break never falls
   * inside a week. Four weeks is about a screenful and keeps each page a
   * unit somebody would actually ask for — "the next month".
   */
  const paged = usePagination(weeks, 4, `${season ?? ""}|${team ?? ""}`);

  if (isLoading) return <Loading what="the fixture calendar" variant="table" />;
  if (isError) return <ErrorNote what="fixture calendar" />;

  return (
    <div>
      <PageHeader
        title="Fixture calendar"
        subtitle="Every match still to play, week by week"
        actions={<PrintButton label="Print the fixture list" />}
      >
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      </PageHeader>

      {team ? (
        <div className="mb-6">
          <TeamFilterNote slug={team} fixtures={fixtures} onClear={() => setTeam(undefined)} />
        </div>
      ) : null}

      {weeks.length === 0 ? (
        <Empty>
          {team
            ? "This team has no matches left in the calendar for this season."
            : "There are no matches still to play in this season. Fixtures for a new season usually appear in September."}
        </Empty>
      ) : (
        <div className="space-y-10">
          {paged.items.map(([week, weekFixtures]) => (
            <section key={week}>
              <h2 className="mb-3 text-xl">Week of {formatDateLong(week)}</h2>
              <FixtureList fixtures={weekFixtures} emptyMessage="Nothing this week." />
            </section>
          ))}
        </div>
      )}

      {weeks.length > 0 ? <Pagination state={paged} noun="weeks" /> : null}

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ResultsPage() {
  const [season, setSeason] = useSeasonParam();
  const [team, setTeam] = useUrlParam("team");
  const { data: seasons } = useSeasons();
  const {
    data: fixtures,
    isLoading,
    isError,
  } = useFixtures(
    `status=played${season ? `&season=${season}` : ""}${team ? `&team=${encodeURIComponent(team)}` : ""}`,
  );

  if (isLoading) return <Loading what="results" variant="table" />;
  if (isError) return <ErrorNote what="results" />;

  return (
    <div>
      <PageHeader
        title="Match history"
        subtitle="Every match played in the league"
        actions={<PrintButton label="Print these results" />}
      >
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      </PageHeader>

      {team ? (
        <div className="mb-6">
          <TeamFilterNote slug={team} fixtures={fixtures} onClear={() => setTeam(undefined)} />
        </div>
      ) : null}

      <FixtureList
        fixtures={fixtures ?? []}
        perPage={25}
        emptyMessage={
          team
            ? "This team has not played a match in this season yet."
            : "No results in this season yet. They appear here once matches have been played and the cards entered."
        }
      />

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * A team's name on the match page, linking to the rest of their season.
 *
 * Shared by the phone and desktop scorelines so the two cannot drift: the
 * link rule lives in one place, and a team the site no longer holds falls
 * back to plain text in both.
 */
function MatchTeamName({ team, status }: { team: TeamRef; status: Fixture["status"] }) {
  if (!team.slug) return <>{team.name}</>;
  return (
    <Link href={teamModuleHref(team.slug, status)} className="link">
      {team.name}
    </Link>
  );
}

export function MatchPage({ id }: { id: string }) {
  const { data: match, isLoading, isError } = useFixture(id);

  if (isLoading) return <Loading what="this match" variant="page" />;
  if (isError || !match) return <ErrorNote what="match" />;

  /*
   * No "we" on a league match. The old page put the home side's score under
   * a win/loss badge written from HRC's point of view, which on the
   * league's own site is a verdict on a match between two other clubs.
   * The scoreline says who won; the winner's name is what carries it.
   */
  const played = match.homeScore !== null && match.awayScore !== null;
  const homeWon = played && match.homeScore! > match.awayScore!;
  const awayWon = played && match.awayScore! > match.homeScore!;

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${match.homeTeam.name} v ${match.awayTeam.name}`}
        subtitle={`${formatDateLong(match.playedOn)}${match.venueName ? ` · ${match.venueName}` : ""}`}
      />

      {/* The scoreline, at the size a scoreline deserves. */}
      <Card>
        <p className="text-ink-muted sm:text-center">
          {COMPETITION_LABELS[match.competition] ?? match.competition}
        </p>

        {/*
          Two layouts, because the two names either side of one big score
          is a shape that only holds while the names are short. At 390px,
          "Cheshunt A v HRC A" in a [1fr auto 1fr] grid broke "Cheshunt"
          onto one line and "A" onto the next, and pushed "HRC A" off the
          edge of the card — the least readable possible rendering of the
          three things this page exists to say.

          On a phone it is a scoreboard instead: a row per team, name on
          the left with the whole width to wrap into, score on the right.
          That is also the shape people are used to reading results in.
        */}
        <ul className="mt-3 sm:hidden">
          {[
            { team: match.homeTeam, score: match.homeScore, won: homeWon, where: "home" },
            { team: match.awayTeam, score: match.awayScore, won: awayWon, where: "away" },
          ].map((side) => (
            <li
              key={side.where}
              className="flex items-center justify-between gap-4 border-b border-line py-2 last:border-b-0"
            >
              <span className={cn("min-w-0 text-lg", side.won && "font-semibold")}>
                <MatchTeamName team={side.team} status={match.status} />
                <span className="block text-ink-muted">{side.where}</span>
              </span>
              {/*
                Muted means "lost", not "did not win" — on a 5-5 draw both
                sides were full strength, and greying them both said the
                opposite of what happened.
              */}
              <span
                className={cn(
                  "shrink-0 text-3xl font-semibold tabular",
                  played && !side.won && (homeWon || awayWon) ? "text-ink-muted" : "text-ink",
                )}
              >
                {side.score ?? "—"}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-3 hidden grid-cols-[1fr_auto_1fr] items-center gap-4 sm:grid">
          <p className={cn("text-right text-xl", homeWon && "font-semibold")}>
            <MatchTeamName team={match.homeTeam} status={match.status} />
          </p>
          <p className="flex items-center gap-3 text-4xl font-semibold tabular">
            <span>{match.homeScore ?? "—"}</span>
            <span aria-hidden="true" className="text-ink-muted">
              –
            </span>
            <span>{match.awayScore ?? "—"}</span>
          </p>
          <p className={cn("text-left text-xl", awayWon && "font-semibold")}>
            <MatchTeamName team={match.awayTeam} status={match.status} />
          </p>
        </div>

        <p className="mt-4 flex flex-wrap items-center gap-3 sm:justify-center">
          {/* Colour is never the only signal, so the outcome is a sentence. */}
          <Badge tone={played ? "positive" : "neutral"}>
            {played
              ? homeWon
                ? `${match.homeTeam.name} won`
                : awayWon
                  ? `${match.awayTeam.name} won`
                  : "Drawn"
              : resultLabel(null, match.status)}
          </Badge>
          {match.startTime ? (
            <span className="text-ink-muted">Started {formatTime(match.startTime)}</span>
          ) : null}
        </p>
        {match.scorecardUrl ? (
          <p className="mt-4">
            <a href={match.scorecardUrl} className="link font-semibold">
              Full scorecard on the league site
            </a>
          </p>
        ) : null}
      </Card>

      <Scorecard match={match} />

      {match.report ? (
        <section aria-labelledby="report-heading">
          <h2 id="report-heading" className="mb-3 text-2xl">
            Match report
          </h2>
          <Prose markdown={match.report} />
        </section>
      ) : null}

      {match.linkedReport ? (
        <p>
          <Link href={`/news/${match.linkedReport.slug}`} className="link font-semibold">
            Read the full report: {match.linkedReport.title}
          </Link>
        </p>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TablesPage() {
  const { data: seasons } = useSeasons();
  const [season, setSeason] = useSeasonParam();
  const { data: standings, isLoading, isError } = useStandings(season);

  const chosen = season ?? seasons?.find((entry) => entry.isCurrent)?.slug ?? seasons?.[0]?.slug;

  if (isLoading) return <Loading what="the league tables" variant="table" />;
  if (isError) return <ErrorNote what="league tables" />;

  return (
    <div>
      <PageHeader
        title="League tables"
        subtitle="Who is top of each division, and how the season is going"
        actions={<PrintButton label="Print the tables" />}
      >
        <SeasonPicker seasons={seasons} value={chosen} onChange={setSeason} />
      </PageHeader>

      <StandingsByDivision standings={standings ?? []} season={chosen} />

      <div className="mt-10 max-w-readable space-y-3">
        <Disclosure summary="How are points worked out?">
          <p>
            A match is ten individual games, and every game won is a point. So a team that wins a
            match 6–4 takes six points from it and their opponents take four — which is why a
            season’s totals run into the hundreds rather than the tens.
          </p>
        </Disclosure>
        <Disclosure summary="What happens if two teams have the same points?">
          {/* Rule 20, quoted from the league's own tables page. */}
          <p>
            Rule 20 of the handbook settles it: the team that has won the most matches is placed
            higher. If that is still not decisive, it comes down to the games between the two teams
            themselves.
          </p>
        </Disclosure>
      </div>

      <SyncNote lastSyncedAt={standings?.[0]?.lastSyncedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function AveragesPage() {
  const { data: stats, isLoading, isError } = useAverages();

  if (isLoading) return <Loading what="the averages" variant="table" />;
  if (isError) return <ErrorNote what="averages" />;

  return (
    <div>
      <PageHeader
        title="Averages"
        subtitle="Who has won what, this season"
        actions={<PrintButton label="Print the averages" />}
      />

      <AveragesByDivision stats={stats ?? []} />

      <div className="mt-10 max-w-readable">
        <Disclosure summary="Why are some players marked “not yet eligible”?">
          <p>
            The league only counts a player in the averages placings once they have played at least
            half of their team’s matches. It stops someone who played twice, and won both, from
            finishing above a player who turned out every week. Everyone’s record is still shown —
            the marker only affects the placings.
          </p>
        </Disclosure>
        <Disclosure summary="Where do these numbers come from?">
          <p>
            They are worked out from the match cards themselves, rubber by rubber, rather than
            typed in separately — so a player’s average changes the moment a card is entered and
            can never disagree with the results it is built from. Singles only: the doubles is a
            pair’s result rather than a player’s, and the league has never counted it here.
          </p>
        </Disclosure>
      </div>

      <SyncNote lastSyncedAt={null} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function HandicapsPage() {
  const { data: stats, isLoading, isError } = useAverages();

  if (isLoading) return <Loading what="handicaps" variant="table" />;
  if (isError) return <ErrorNote what="handicaps" />;

  return (
    <div>
      <PageHeader title="Handicaps" subtitle="This season's handicap ratings" />
      <HandicapTable stats={stats ?? []} />
      <SyncNote lastSyncedAt={null} />
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The league's "Cup News" page: everything that is not routine league
 * business, in one place, because a cup run is the thing members most want
 * to follow.
 */
export function CupsPage() {
  const { data: fixtures, isLoading, isError } = useFixtures("competition=cup");

  if (isLoading) return <Loading what="cup matches" variant="table" />;
  if (isError) return <ErrorNote what="cup matches" />;

  const played = (fixtures ?? []).filter((fixture) => fixture.status === "played");
  const toPlay = (fixtures ?? []).filter((fixture) => fixture.status !== "played");

  return (
    <div className="space-y-10">
      <PageHeader title="Cup news" subtitle="The cups, and how each round has gone" />

      {(fixtures ?? []).length === 0 ? (
        <Empty>
          There are no cup matches on record this season. Cup rounds are usually drawn once the
          league programme is under way.
        </Empty>
      ) : (
        <>
          <section aria-labelledby="cups-to-play">
            <h2 id="cups-to-play" className="mb-3 text-2xl">
              Still to play
            </h2>
            <FixtureList fixtures={toPlay} emptyMessage="No cup matches left in the calendar." />
          </section>

          <section aria-labelledby="cups-played">
            <h2 id="cups-played" className="mb-3 text-2xl">
              Cup results
            </h2>
            <FixtureList
              fixtures={played}
              emptyMessage="No cup matches played yet this season."
            />
          </section>
        </>
      )}

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}
