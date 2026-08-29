import { Link } from "wouter";
import { COMPETITION_LABELS } from "@shared/enums.js";
import { PageHeader, PrintButton } from "@/components/layout";
import { AveragesTable, FixtureList, HandicapTable, StandingsByDivision } from "@/components/data";
import {
  Badge,
  Card,
  Disclosure,
  Empty,
  ErrorNote,
  Loading,
  Prose,
  TableNote,
  TableScroller,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { useAverages, useFixture, useFixtures, useSettings, useStandings } from "@/lib/queries";
import { formatDateLong, formatTime, resultLabel } from "@/lib/utils";

/**
 * A small note under every page that shows synced league data, saying where
 * it came from and when it last arrived. Being able to see that a table is
 * an hour old is the difference between trusting it and not.
 */
function SyncNote({ lastSyncedAt }: { lastSyncedAt: string | null | undefined }) {
  const { data: settings } = useSettings();
  return (
    <p className="mt-8 border-t border-line pt-5 text-ink-muted">
      Fixtures and results come from the{" "}
      {settings?.leagueUrl ? (
        <a href={settings.leagueUrl} className="link">
          league's own records
        </a>
      ) : (
        "league's own records"
      )}
      , where captains enter them.
      {lastSyncedAt ? ` Last updated ${formatDateLong(lastSyncedAt)}.` : null}
    </p>
  );
}

// ---------------------------------------------------------------------------

export function FixturesPage() {
  const { data: fixtures, isLoading, isError } = useFixtures("status=scheduled");

  if (isLoading) return <Loading what="the fixture calendar" variant="table" />;
  if (isError) return <ErrorNote what="fixture calendar" />;

  // Grouped by the league's own week-commencing scheduling, because that is
  // how captains and players think about the season — "week of the 12th",
  // not "the 14th and the 16th".
  const weeks = new Map<string, typeof fixtures>();
  for (const fixture of fixtures ?? []) {
    const key = fixture.weekCommencing ?? fixture.playedOn ?? "unscheduled";
    weeks.set(key, [...(weeks.get(key) ?? []), fixture]);
  }

  return (
    <div>
      <PageHeader
        title="Fixture calendar"
        subtitle="Every match still to play, week by week"
        actions={<PrintButton label="Print the fixture list" />}
      />

      {weeks.size === 0 ? (
        <Empty>
          There are no matches in the calendar at the moment. Fixtures for a new season usually
          appear in September.
        </Empty>
      ) : (
        <div className="space-y-10">
          {[...weeks.entries()].map(([week, weekFixtures]) => (
            <section key={week}>
              <h2 className="mb-3 text-xl">Week of {formatDateLong(week)}</h2>
              <FixtureList fixtures={weekFixtures ?? []} emptyMessage="Nothing this week." />
            </section>
          ))}
        </div>
      )}

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function ResultsPage() {
  const { data: fixtures, isLoading, isError } = useFixtures("status=played");

  if (isLoading) return <Loading what="results" variant="table" />;
  if (isError) return <ErrorNote what="results" />;

  return (
    <div>
      <PageHeader
        title="Match history"
        subtitle="Every match played in the league this season"
        actions={<PrintButton label="Print these results" />}
      />

      <FixtureList
        fixtures={fixtures ?? []}
        showResult
        emptyMessage="No results yet this season. They appear here once matches have been played and the cards confirmed."
      />

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}

// ---------------------------------------------------------------------------

export function MatchPage({ id }: { id: string }) {
  const { data: match, isLoading, isError } = useFixture(id);

  if (isLoading) return <Loading what="this match" variant="page" />;
  if (isError || !match) return <ErrorNote what="match" />;

  const tone =
    match.result === "win" ? "positive" : match.result === "loss" ? "negative" : "neutral";

  return (
    <div className="space-y-10">
      <PageHeader
        title={`${match.teamName} v ${match.opponentName}`}
        subtitle={`${formatDateLong(match.playedOn)} · ${match.isHome ? "at home" : "away"}`}
      />

      {/* The scoreline, at the size a scoreline deserves. */}
      <Card className="text-center">
        <p className="text-ink-muted">{COMPETITION_LABELS[match.competition] ?? match.competition}</p>
        <p className="mt-2 flex items-center justify-center gap-4 text-4xl font-semibold tabular">
          <span>{match.hrcScore ?? "—"}</span>
          <span aria-hidden="true" className="text-ink-muted">
            –
          </span>
          <span>{match.opponentScore ?? "—"}</span>
        </p>
        <p className="mt-1 text-ink-muted">
          {match.teamName} v {match.opponentName}
        </p>
        <p className="mt-4 flex flex-wrap items-center justify-center gap-3">
          <Badge tone={tone}>{resultLabel(match.result, match.status)}</Badge>
          {match.startTime ? (
            <span className="text-ink-muted">Started {formatTime(match.startTime)}</span>
          ) : null}
          {match.venueName ? <span className="text-ink-muted">At {match.venueName}</span> : null}
        </p>
        {match.scorecardUrl ? (
          <p className="mt-4">
            <a href={match.scorecardUrl} className="link font-semibold">
              Full scorecard on the league site
            </a>
          </p>
        ) : null}
      </Card>

      {match.rubbers.length > 0 ? (
        <section aria-labelledby="card-heading">
          <h2 id="card-heading" className="mb-3 text-2xl">
            The card
          </h2>
          <TableNote>
            Each line is one game between two players — a “rubber”. The set scores are shown as they
            were written on the card on the night.
          </TableNote>
          <TableScroller>
            <thead>
              <tr>
                <Th className="w-14 text-right">#</Th>
                <Th>{match.teamName}</Th>
                <Th>{match.opponentName}</Th>
                <Th className="text-right">Sets</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {match.rubbers.map((rubber) => (
                <Tr key={rubber.id}>
                  <Td className="tabular text-right text-ink-muted">{rubber.rubberNumber}</Td>
                  <Td className="font-semibold">
                    {rubber.memberSlug ? (
                      <Link href={`/players/${rubber.memberSlug}`} className="link">
                        {rubber.memberName}
                      </Link>
                    ) : (
                      (rubber.memberName ?? "—")
                    )}
                  </Td>
                  <Td>{rubber.opponentPlayerName ?? "—"}</Td>
                  <Td className="tabular text-right">
                    <span className="font-semibold">
                      {rubber.setsFor}–{rubber.setsAgainst}
                    </span>
                    {rubber.scoreDetail ? (
                      <span className="block text-ink-muted">{rubber.scoreDetail}</span>
                    ) : null}
                  </Td>
                  <Td>
                    <Badge tone={rubber.won ? "positive" : "negative"}>
                      {rubber.won ? "Won" : "Lost"}
                    </Badge>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </TableScroller>
        </section>
      ) : null}

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
  const { data: standings, isLoading, isError } = useStandings();

  if (isLoading) return <Loading what="the league tables" variant="table" />;
  if (isError) return <ErrorNote what="league tables" />;

  return (
    <div>
      <PageHeader
        title="League tables"
        subtitle="Who is top of each division, and how the season is going"
        actions={<PrintButton label="Print the tables" />}
      />

      <StandingsByDivision standings={standings ?? []} />

      <div className="mt-10 max-w-readable">
        <Disclosure summary="What happens if two teams have the same points?">
          <p>
            The league separates them on the matches between those two teams first, and then on sets
            won across the season. It is settled by the league — the table above shows the order the
            league has published.
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

      <AveragesTable stats={stats ?? []} />

      <div className="mt-10 max-w-readable">
        <Disclosure summary="Why are some players marked “not yet eligible”?">
          <p>
            The league only counts a player in the averages placings once they have played at least
            half of their team’s matches. It stops someone who played twice, and won both, from
            finishing above a player who turned out every week. Everyone’s record is still shown —
            the marker only affects the placings.
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
              showResult
              emptyMessage="No cup matches played yet this season."
            />
          </section>
        </>
      )}

      <SyncNote lastSyncedAt={fixtures?.[0]?.lastSyncedAt} />
    </div>
  );
}
