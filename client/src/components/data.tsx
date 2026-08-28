import { Link } from "wouter";
import type { Fixture, PlayerStat, Standing } from "@shared/types.js";
import { COMPETITION_LABELS, DIVISION } from "@shared/enums.js";
import { Badge, Card, Empty, TableNote, TableScroller, Td, Th } from "@/components/ui";
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
    <span className="tabular font-bold">
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
              <tr key={fixture.id}>
                <Td className="whitespace-nowrap">{formatDateShort(fixture.playedOn)}</Td>
                {showTeam ? (
                  <Td className="whitespace-nowrap">
                    <Link href={`/teams/${fixture.teamSlug}`} className="text-brand underline">
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
                <Td>
                  <VenueWord fixture={fixture} />
                </Td>
                {showResult ? (
                  <Td>
                    <Link href={`/results/${fixture.id}`} className="text-brand underline">
                      <ScoreText fixture={fixture} />
                    </Link>
                  </Td>
                ) : null}
                <Td>
                  {showResult ? (
                    <ResultBadge fixture={fixture} />
                  ) : (
                    (formatTime(fixture.startTime) || "—")
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {fixtures.map((fixture) => (
          <li key={fixture.id}>
            <Card>
              <p className="font-bold">{formatDateShort(fixture.playedOn)}</p>
              <p className="mt-1 text-lg">
                {showTeam ? `${fixture.teamName} ` : ""}v {fixture.opponentName}
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
                  <Link href={`/results/${fixture.id}`} className="text-brand underline">
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
      <TableNote>
        This shows how many matches each team has played and how many points they have. Most points
        at the top. Our own teams are marked “HRC”.
      </TableNote>

      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th className="w-12">Pos</Th>
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
              <tr key={row.id} className={cn(row.isHrc && "bg-brand-soft")}>
                <Td className="tabular">{row.position}</Td>
                <Td className="font-semibold">
                  {row.teamName}
                  {row.isHrc ? (
                    <span className="ml-2">
                      <Badge tone="positive">HRC</Badge>
                    </span>
                  ) : null}
                </Td>
                <Td className="tabular text-right">{row.played}</Td>
                <Td className="tabular text-right">{row.won}</Td>
                <Td className="tabular text-right">{row.drawn}</Td>
                <Td className="tabular text-right">{row.lost}</Td>
                <Td className="tabular text-right font-bold">{row.points}</Td>
              </tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {standings.map((row) => (
          <li key={row.id}>
            <Card className={cn(row.isHrc && "border-brand bg-brand-soft")}>
              <p className="text-lg font-bold">
                {row.position}. {row.teamName}{" "}
                {row.isHrc ? <Badge tone="positive">HRC</Badge> : null}
              </p>
              <p className="mt-1 tabular text-ink-muted">
                Played {row.played} · Won {row.won} · Drawn {row.drawn} · Lost {row.lost}
              </p>
              <p className="mt-1 text-lg font-bold tabular">{row.points} points</p>
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
        This shows how many matches each player has played and how many they won. “Eligible” means
        the player has played at least half the club’s matches — the league only counts a player for
        the averages placings once they have.
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
              <tr key={row.id}>
                <Td className="font-semibold">
                  {row.memberSlug ? (
                    <Link href={`/players/${row.memberSlug}`} className="text-brand underline">
                      {row.memberName}
                    </Link>
                  ) : (
                    row.memberName
                  )}
                </Td>
                <Td>{row.teamName ?? "—"}</Td>
                <Td className="tabular text-right">{row.played}</Td>
                <Td className="tabular text-right">{row.won}</Td>
                <Td className="tabular text-right">{row.lost}</Td>
                <Td className="tabular text-right font-bold">
                  {row.winPercentage === null ? "—" : `${Math.round(row.winPercentage)}%`}
                </Td>
                <Td>
                  {row.meetsParticipationThreshold ? (
                    <Badge tone="positive">Eligible</Badge>
                  ) : (
                    <Badge>Not yet eligible</Badge>
                  )}
                </Td>
              </tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {stats.map((row) => (
          <li key={row.id}>
            <Card>
              <p className="text-lg font-bold">
                {row.memberSlug ? (
                  <Link href={`/players/${row.memberSlug}`} className="text-brand underline">
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
              <tr key={row.id}>
                <Td className="font-semibold">
                  {row.memberSlug ? (
                    <Link href={`/players/${row.memberSlug}`} className="text-brand underline">
                      {row.memberName}
                    </Link>
                  ) : (
                    row.memberName
                  )}
                </Td>
                <Td>{row.teamName ?? "—"}</Td>
                <Td className="tabular text-right font-bold">{row.handicap}</Td>
              </tr>
            ))}
          </tbody>
        </TableScroller>
      </div>

      <ul className="space-y-3 sm:hidden">
        {rated.map((row) => (
          <li key={row.id}>
            <Card>
              <p className="text-lg font-bold">{row.memberName}</p>
              <p className="text-ink-muted">{row.teamName ?? "No team recorded"}</p>
              <p className="mt-1 text-lg tabular">Handicap {row.handicap}</p>
            </Card>
          </li>
        ))}
      </ul>
    </>
  );
}
