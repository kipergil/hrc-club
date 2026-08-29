import { Link } from "wouter";
import type { Fixture, PlayerStat, Standing, TeamFixture, TeamRef } from "@shared/types.js";
import { COMPETITION_LABELS, DIVISION } from "@shared/enums.js";
import {
  Badge,
  Card,
  Empty,
  Pagination,
  TableNote,
  TableScroller,
  Td,
  Th,
  Tr,
  usePagination,
} from "@/components/ui";
import { cn, divisionLabel, formatDateShort, formatTime, resultLabel } from "@/lib/utils";

/**
 * Every wide table on this site ships twice: as a real `<table>` from 640px
 * up, and as a list of cards below it. Only one is in the DOM's
 * accessibility tree at a time (`hidden` removes the other), so a screen
 * reader reads one copy, not two.
 *
 * The alternative — one table that scrolls sideways on a phone — is what
 * the site this replaces does, and a horizontally scrolling league table on
 * a 5-inch screen is functionally unreadable.
 */

// ---------------------------------------------------------------------------
// Fixtures and results
// ---------------------------------------------------------------------------

/**
 * A team name that links to its page when the site holds one.
 *
 * An archived season can name a team that has since folded, and a name with
 * a dead link behind it is worse than a name.
 */
function TeamName({ team, bold = false }: { team: TeamRef; bold?: boolean }) {
  if (!team.slug) return <span className={cn(bold && "font-semibold")}>{team.name}</span>;
  return (
    <Link href={`/teams/${team.slug}`} className={cn("link", bold && "font-semibold")}>
      {team.name}
    </Link>
  );
}

function Scoreline({ home, away }: { home: number | null; away: number | null }) {
  if (home === null || away === null) {
    return (
      <span className="text-ink-muted">
        {/* Not "0–0", which is a result somebody played for. */}
        not yet played
      </span>
    );
  }
  return (
    <span className="tabular text-lg font-semibold">
      {home}–{away}
    </span>
  );
}

function CompetitionNote({ competition }: { competition: Fixture["competition"] }) {
  if (competition === "league") return null;
  return (
    <span className="ml-2 text-ink-muted">
      ({COMPETITION_LABELS[competition] ?? competition})
    </span>
  );
}

/**
 * Every match in a list, home team first — the league's own fixture format.
 *
 * This used to show a team and an "opponent", which only reads correctly on
 * a site belonging to one of the two clubs. On the league's own site both
 * sides are equal, and the scoreline has to be the right way round for a
 * reader who supports either of them.
 */
export function FixtureList({
  fixtures,
  emptyMessage,
  perPage,
}: {
  fixtures: Fixture[];
  emptyMessage: string;
  /** Set on the flat league-wide lists, which run to two hundred rows. */
  perPage?: number;
}) {
  const paged = usePagination(fixtures, perPage ?? Number.MAX_SAFE_INTEGER);
  const shown = paged.items as Fixture[];

  if (fixtures.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <>
      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th className="text-right">Home</Th>
              <Th className="w-28 text-center">Score</Th>
              <Th>Away</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((fixture) => (
              <Tr key={fixture.id}>
                <Td className="whitespace-nowrap text-ink-muted">
                  {formatDateShort(fixture.playedOn)}
                  <CompetitionNote competition={fixture.competition} />
                </Td>
                <Td className="text-right">
                  <TeamName team={fixture.homeTeam} bold />
                </Td>
                <Td className="text-center">
                  {fixture.status === "played" ? (
                    <Link href={`/results/${fixture.id}`} className="link">
                      <Scoreline home={fixture.homeScore} away={fixture.awayScore} />
                    </Link>
                  ) : (
                    <span className="tabular text-ink-muted">
                      {formatTime(fixture.startTime) || "v"}
                    </span>
                  )}
                </Td>
                <Td>
                  <TeamName team={fixture.awayTeam} bold />
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {shown.map((fixture) => (
          <li key={fixture.id}>
            <Card>
              <p className="text-ink-muted">
                {formatDateShort(fixture.playedOn)}
                <CompetitionNote competition={fixture.competition} />
              </p>
              <p className="mt-1 text-lg">
                <TeamName team={fixture.homeTeam} bold />
                <span className="text-ink-muted"> v </span>
                <TeamName team={fixture.awayTeam} bold />
              </p>
              <p className="mt-2">
                {fixture.status === "played" ? (
                  <Link href={`/results/${fixture.id}`} className="link">
                    <Scoreline home={fixture.homeScore} away={fixture.awayScore} />
                  </Link>
                ) : (
                  <span className="text-ink-muted">
                    {fixture.startTime ? formatTime(fixture.startTime) : "Not yet played"}
                  </span>
                )}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      {perPage ? <Pagination state={paged} noun="matches" /> : null}
    </>
  );
}

/**
 * One team's season, the way `MatchHistory.asp` lists it: every match the
 * team plays, home and away, with the result from their side.
 */
export function TeamFixtureList({
  fixtures,
  emptyMessage,
}: {
  fixtures: TeamFixture[];
  emptyMessage: string;
}) {
  if (fixtures.length === 0) return <Empty>{emptyMessage}</Empty>;

  return (
    <>
      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th>Date</Th>
              <Th>Opponent</Th>
              <Th>Where</Th>
              <Th className="w-28 text-center">Score</Th>
              <Th>Result</Th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((fixture) => (
              <Tr key={fixture.id}>
                <Td className="whitespace-nowrap text-ink-muted">
                  {formatDateShort(fixture.playedOn)}
                  <CompetitionNote competition={fixture.competition} />
                </Td>
                <Td>
                  <TeamName team={fixture.opponent} bold />
                </Td>
                {/* A word, not an H or an A the reader has to decode. */}
                <Td className="text-ink-muted">{fixture.isHome ? "at home" : "away"}</Td>
                <Td className="text-center">
                  {fixture.status === "played" ? (
                    <Link href={`/results/${fixture.id}`} className="link">
                      <Scoreline home={fixture.teamScore} away={fixture.opponentScore} />
                    </Link>
                  ) : (
                    <span className="tabular text-ink-muted">
                      {formatTime(fixture.startTime) || "—"}
                    </span>
                  )}
                </Td>
                <Td>
                  <ResultBadge fixture={fixture} />
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {fixtures.map((fixture) => (
          <li key={fixture.id}>
            <Card>
              <p className="text-ink-muted">
                {formatDateShort(fixture.playedOn)}
                <CompetitionNote competition={fixture.competition} />
              </p>
              <p className="mt-1 text-lg">
                <span className="text-ink-muted">{fixture.isHome ? "at home to " : "away to "}</span>
                <TeamName team={fixture.opponent} bold />
              </p>
              <p className="mt-2 flex flex-wrap items-center gap-3">
                <ResultBadge fixture={fixture} />
                {fixture.status === "played" ? (
                  <Link href={`/results/${fixture.id}`} className="link">
                    <Scoreline home={fixture.teamScore} away={fixture.opponentScore} />
                  </Link>
                ) : fixture.startTime ? (
                  <span className="text-ink-muted">{formatTime(fixture.startTime)}</span>
                ) : null}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

function ResultBadge({ fixture }: { fixture: TeamFixture }) {
  const label = resultLabel(fixture.result, fixture.status);
  const tone =
    fixture.result === "win" ? "positive" : fixture.result === "loss" ? "negative" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

// ---------------------------------------------------------------------------
// League tables
// ---------------------------------------------------------------------------

export function StandingsTable({
  standings,
  season,
}: {
  standings: Standing[];
  /** Carried into the team links so a table row leads to that season. */
  season?: string;
}) {
  if (standings.length === 0) {
    return (
      <Empty>
        No table has been published for this division yet. Tables usually appear once every team has
        played a match or two.
      </Empty>
    );
  }

  return (
    <>
      {/*
        This used to end "Our own teams are marked HRC" — written when the
        site belonged to one club. On the league's own site there is no
        "our", and every team in the table has an equal claim to it.
      */}
      <TableNote>
        How many matches each team has played and how many points they have. Most points at the top.
      </TableNote>

      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th className="w-14 text-right">Pos</Th>
              <Th>Team</Th>
              <Th className="text-right">Played</Th>
              <Th className="text-right">Won</Th>
              <Th className="text-right">Drawn</Th>
              <Th className="text-right">Lost</Th>
              <Th className="text-right">Points</Th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <Tr key={row.id} highlight={row.isHrc}>
                <Td className="tabular text-right text-ink-muted">{row.position}</Td>
                <Td className="font-semibold">
                  {/*
                    "Click on your Team Name in the relevant table below to
                    see all your team's League Matches for the season" — the
                    league's own instruction on its tables page, and the
                    main way anyone navigates it.
                  */}
                  {row.teamSlug ? (
                    <Link
                      href={`/teams/${row.teamSlug}${season ? `?season=${season}` : ""}`}
                      className="link"
                    >
                      {row.teamName}
                    </Link>
                  ) : (
                    row.teamName
                  )}
                  {/*
                    The tint is never the only thing marking this row.
                    `isHrc` flags a team belonging to the club whose site
                    this is — nobody, on the league's own site, which is
                    why this is easy to drop by accident and why there is
                    a test for it.
                  */}
                  {row.isHrc ? (
                    <span className="ml-2">
                      <Badge tone="brand">Your club</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td className="tabular text-right">{row.played}</Td>
                <Td className="tabular text-right">{row.won}</Td>
                <Td className="tabular text-right">{row.drawn}</Td>
                <Td className="tabular text-right">{row.lost}</Td>
                <Td className="tabular text-right text-lg font-semibold">{row.points}</Td>
              </Tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {standings.map((row) => (
          <li key={row.id}>
            <Card className={cn(row.isHrc && "border-brand bg-brand-soft")}>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold">
                  <span className="tabular text-ink-muted">{row.position}.</span>{" "}
                  {row.teamSlug ? (
                    <Link
                      href={`/teams/${row.teamSlug}${season ? `?season=${season}` : ""}`}
                      className="link"
                    >
                      {row.teamName}
                    </Link>
                  ) : (
                    row.teamName
                  )}
                </p>
                <p className="shrink-0 text-lg font-semibold tabular">{row.points} pts</p>
              </div>
              {row.isHrc ? (
                <p className="mt-1.5">
                  <Badge tone="brand">Your club</Badge>
                </p>
              ) : null}
              <p className="mt-1 tabular text-ink-muted">
                Played {row.played} · Won {row.won} · Drawn {row.drawn} · Lost {row.lost}
              </p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

export function StandingsByDivision({
  standings,
  season,
}: {
  standings: Standing[];
  season?: string;
}) {
  // Ordered by the league's own hierarchy, not alphabetically — a page that
  // opens with Division 1 above the Premier Division reads as a mistake.
  const divisions = DIVISION.filter((division) =>
    standings.some((row) => row.division === division),
  );

  if (divisions.length === 0) {
    return (
      <Empty>
        No league tables have been published yet this season. They will appear here once the first
        matches have been played.
      </Empty>
    );
  }

  return (
    <div className="space-y-12">
      {divisions.map((division) => (
        <section key={division}>
          <h2 className="mb-3 text-2xl">{divisionLabel(division)}</h2>
          <StandingsTable
            standings={standings.filter((row) => row.division === division)}
            season={season}
          />
        </section>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Averages and handicaps
// ---------------------------------------------------------------------------

/**
 * A win percentage, shown as a number and as a bar.
 *
 * The bar is `aria-hidden` and the number is not, so the figure is read
 * once. It is there because a column of percentages is hard to compare at
 * a glance and a column of bars is not — and it costs nothing to anyone
 * reading with a screen reader or on paper.
 */
function WinRate({ percentage }: { percentage: number | null }) {
  if (percentage === null) return <span className="text-ink-muted">—</span>;
  const rounded = Math.round(percentage);
  return (
    <span className="flex items-center justify-end gap-2">
      <span className="tabular font-semibold">{rounded}%</span>
      <span aria-hidden="true" className="hidden h-2 w-16 overflow-hidden rounded-full bg-surface-sunken lg:block">
        <span className="block h-full rounded-full bg-brand" style={{ width: `${rounded}%` }} />
      </span>
    </span>
  );
}

export function AveragesTable({ stats }: { stats: PlayerStat[] }) {
  const paged = usePagination(stats, 25);
  const shown = paged.items as PlayerStat[];

  if (stats.length === 0) {
    return (
      <Empty>
        No averages have been published yet this season. They appear once matches have been played
        and the results confirmed.
      </Empty>
    );
  }

  return (
    <>
      <TableNote>
        How many matches each player has played and how many they won. “Eligible” means the player
        has played at least half their team’s matches — the league only counts a player for the
        averages placings once they have.
      </TableNote>

      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th>Player</Th>
              <Th>Team</Th>
              <Th className="text-right">Played</Th>
              <Th className="text-right">Won</Th>
              <Th className="text-right">Lost</Th>
              <Th className="text-right">Win %</Th>
              <Th>Placings</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Tr key={row.id}>
                <Td className="font-semibold">
                  {row.memberSlug ? (
                    <Link href={`/players/${row.memberSlug}`} className="link">
                      {row.memberName}
                    </Link>
                  ) : (
                    row.memberName
                  )}
                </Td>
                <Td className="text-ink-muted">{row.teamName ?? "—"}</Td>
                <Td className="tabular text-right">{row.played}</Td>
                <Td className="tabular text-right">{row.won}</Td>
                <Td className="tabular text-right">{row.lost}</Td>
                <Td className="text-right">
                  <WinRate percentage={row.winPercentage} />
                </Td>
                <Td>
                  {row.meetsParticipationThreshold ? (
                    <Badge tone="positive">Eligible</Badge>
                  ) : (
                    <Badge>Not yet eligible</Badge>
                  )}
                </Td>
              </Tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {shown.map((row) => (
          <li key={row.id}>
            <Card>
              <p className="text-lg font-semibold">
                {row.memberSlug ? (
                  <Link href={`/players/${row.memberSlug}`} className="link">
                    {row.memberName}
                  </Link>
                ) : (
                  row.memberName
                )}
              </p>
              <p className="text-ink-muted">{row.teamName ?? "No team recorded"}</p>
              <p className="mt-1 tabular">
                Played {row.played} · Won {row.won} · Lost {row.lost}
                {row.winPercentage === null ? null : ` · ${Math.round(row.winPercentage)}%`}
              </p>
              <p className="mt-2">
                {row.meetsParticipationThreshold ? (
                  <Badge tone="positive">Eligible</Badge>
                ) : (
                  <Badge>Not yet eligible</Badge>
                )}
              </p>
            </Card>
          </li>
        ))}
      </ul>

      <Pagination state={paged} noun="players" />
    </>
  );
}

export function HandicapTable({ stats }: { stats: PlayerStat[] }) {
  const rated = stats.filter((row) => row.handicap !== null);
  const paged = usePagination(rated, 25);
  const shown = paged.items as PlayerStat[];

  if (rated.length === 0) {
    return (
      <Empty>
        No handicaps have been set for this season yet. The match secretary publishes them once the
        season is under way.
      </Empty>
    );
  }

  return (
    <>
      <TableNote>
        A handicap is a head start. In handicap competitions the player with the higher number
        starts each game with that many points already on the board, so a beginner and a county
        player can have a real match.
      </TableNote>

      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th>Player</Th>
              <Th>Team</Th>
              <Th className="text-right">Handicap</Th>
            </tr>
          </thead>
          <tbody>
            {shown.map((row) => (
              <Tr key={row.id}>
                <Td className="font-semibold">
                  {row.memberSlug ? (
                    <Link href={`/players/${row.memberSlug}`} className="link">
                      {row.memberName}
                    </Link>
                  ) : (
                    row.memberName
                  )}
                </Td>
                <Td className="text-ink-muted">{row.teamName ?? "—"}</Td>
                <Td className="tabular text-right text-lg font-semibold">{row.handicap}</Td>
              </Tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {shown.map((row) => (
          <li key={row.id}>
            <Card>
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-lg font-semibold">{row.memberName}</p>
                <p className="shrink-0 text-lg font-semibold tabular">{row.handicap}</p>
              </div>
              <p className="text-ink-muted">{row.teamName ?? "No team recorded"}</p>
            </Card>
          </li>
        ))}
      </ul>

      <Pagination state={paged} noun="players" />
    </>
  );
}
