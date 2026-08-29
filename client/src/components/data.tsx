import { Link } from "wouter";
import type { Fixture, PlayerStat, Standing } from "@shared/types.js";
import { COMPETITION_LABELS, DIVISION } from "@shared/enums.js";
import { Badge, Card, Empty, TableNote, TableScroller, Td, Th, Tr } from "@/components/ui";
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

function ResultBadge({ fixture }: { fixture: Fixture }) {
  const label = resultLabel(fixture.result, fixture.status);
  const tone =
    fixture.result === "win" ? "positive" : fixture.result === "loss" ? "negative" : "neutral";
  return <Badge tone={tone}>{label}</Badge>;
}

function ScoreText({ fixture }: { fixture: Fixture }) {
  if (fixture.hrcScore === null || fixture.opponentScore === null) return <span>—</span>;
  return (
    <span className="tabular text-lg font-semibold">
      {fixture.hrcScore}–{fixture.opponentScore}
    </span>
  );
}

function VenueWord({ fixture }: { fixture: Fixture }) {
  // Home and away get a word, not a colour and not an H/A the reader has to
  // decode from a key somewhere else on the page.
  return <span>{fixture.isHome ? "at home" : "away"}</span>;
}

export function FixtureList({
  fixtures,
  showTeam = true,
  showResult = false,
  emptyMessage,
}: {
  fixtures: Fixture[];
  showTeam?: boolean;
  showResult?: boolean;
  emptyMessage: string;
}) {
  if (fixtures.length === 0) {
    return <Empty>{emptyMessage}</Empty>;
  }

  return (
    <>
      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th>Date</Th>
              {showTeam ? <Th>Team</Th> : null}
              <Th>Opponent</Th>
              <Th>Where</Th>
              {showResult ? <Th>Score</Th> : null}
              <Th>{showResult ? "Result" : "Start"}</Th>
            </tr>
          </thead>
          <tbody>
            {fixtures.map((fixture) => (
              <Tr key={fixture.id}>
                <Td className="whitespace-nowrap">{formatDateShort(fixture.playedOn)}</Td>
                {showTeam ? (
                  <Td className="whitespace-nowrap font-semibold">
                    <Link href={`/teams/${fixture.teamSlug}`} className="link">
                      {fixture.teamName}
                    </Link>
                  </Td>
                ) : null}
                <Td>
                  {fixture.opponentName}
                  {fixture.competition !== "league" ? (
                    <span className="ml-2 text-ink-muted">
                      ({COMPETITION_LABELS[fixture.competition] ?? fixture.competition})
                    </span>
                  ) : null}
                </Td>
                <Td className="text-ink-muted">
                  <VenueWord fixture={fixture} />
                </Td>
                {showResult ? (
                  <Td>
                    <Link href={`/results/${fixture.id}`} className="link">
                      <ScoreText fixture={fixture} />
                    </Link>
                  </Td>
                ) : null}
                <Td>
                  {showResult ? (
                    <ResultBadge fixture={fixture} />
                  ) : (
                    <span className="tabular">{formatTime(fixture.startTime) || "—"}</span>
                  )}
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
              <p className="font-semibold text-ink-muted">{formatDateShort(fixture.playedOn)}</p>
              <p className="mt-1 text-lg">
                {showTeam ? <span className="font-semibold">{fixture.teamName} </span> : null}v{" "}
                {fixture.opponentName}
              </p>
              <p className="mt-1 text-ink-muted">
                <VenueWord fixture={fixture} />
                {fixture.competition !== "league"
                  ? ` · ${COMPETITION_LABELS[fixture.competition] ?? fixture.competition}`
                  : null}
                {!showResult && fixture.startTime ? ` · ${formatTime(fixture.startTime)}` : null}
              </p>
              {showResult ? (
                <p className="mt-3 flex items-center gap-3">
                  <ResultBadge fixture={fixture} />
                  <Link href={`/results/${fixture.id}`} className="link">
                    <ScoreText fixture={fixture} />
                  </Link>
                </p>
              ) : null}
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}

// ---------------------------------------------------------------------------
// League tables
// ---------------------------------------------------------------------------

export function StandingsTable({ standings }: { standings: Standing[] }) {
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
                  {row.teamName}
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
                  <span className="tabular text-ink-muted">{row.position}.</span> {row.teamName}
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

export function StandingsByDivision({ standings }: { standings: Standing[] }) {
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
          <StandingsTable standings={standings.filter((row) => row.division === division)} />
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
            {stats.map((row) => (
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
        {stats.map((row) => (
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
    </>
  );
}

export function HandicapTable({ stats }: { stats: PlayerStat[] }) {
  const rated = stats.filter((row) => row.handicap !== null);

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
            {rated.map((row) => (
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
        {rated.map((row) => (
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
    </>
  );
}
