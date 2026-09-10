import { Link } from "wouter";
import type { Fixture, PlayerStat, Standing, TeamFixture, TeamRef } from "@shared/types.js";
import { COMPETITION_LABELS, DIVISION } from "@shared/enums.js";
import {
  Alert,
  Badge,
  Card,
  Empty,
  Pagination,
  Prose,
  TableNote,
  TableScroller,
  Td,
  Th,
  Tr,
  usePagination,
} from "@/components/ui";
import {
  cn,
  divisionLabel,
  formatDateLong,
  formatDateShort,
  formatTime,
  resultLabel,
} from "@/lib/utils";
import { teamFixturesHref, teamHref, teamModuleHref } from "@/lib/links";
import { nightOf } from "@/lib/calendar";
import type {
  CalendarCell,
  CalendarColumn,
  CalendarSegment,
  CalendarWeekBlock,
} from "@/lib/calendar";

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
 * A team name that links somewhere useful when the site holds the team.
 *
 * An archived season can name a team that has since folded, and a name with
 * a dead link behind it is worse than a name.
 *
 * The destination is passed in rather than assumed, because it depends on
 * where the name is being read: see `lib/links.ts`. It used to be
 * `/teams/:slug` everywhere, which took somebody reading results out of the
 * results and dropped them at the top of a profile page.
 */
function TeamName({
  team,
  bold = false,
  href,
}: {
  team: TeamRef;
  bold?: boolean;
  href?: (slug: string) => string;
}) {
  if (!team.slug) return <span className={cn(bold && "font-semibold")}>{team.name}</span>;
  return (
    <Link
      href={href ? href(team.slug) : teamHref(team.slug)}
      className={cn("link", bold && "font-semibold")}
    >
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
                  <TeamName
                    team={fixture.homeTeam}
                    bold
                    href={(slug) => teamModuleHref(slug, fixture.status)}
                  />
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
                  <TeamName
                    team={fixture.awayTeam}
                    bold
                    href={(slug) => teamModuleHref(slug, fixture.status)}
                  />
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
                <TeamName
                    team={fixture.homeTeam}
                    bold
                    href={(slug) => teamModuleHref(slug, fixture.status)}
                  />
                <span className="text-ink-muted"> v </span>
                <TeamName
                    team={fixture.awayTeam}
                    bold
                    href={(slug) => teamModuleHref(slug, fixture.status)}
                  />
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

  /*
   * The league's archived tables publish team, played and points — no
   * more. Rather than print a column of dashes for the fifteen seasons
   * that have no win/loss breakdown, the columns that are unknown the
   * whole way down are left out, and the note says which table this is.
   * `some` rather than `every` so a single team yet to play does not
   * collapse the column for the rest of the division.
   */
  const hasRecord = standings.some((row) => row.won !== null);
  const incomplete = standings.find((row) => row.seasonIncomplete !== null)?.seasonIncomplete;

  return (
    <>
      {/*
        This used to end "Our own teams are marked HRC" — written when the
        site belonged to one club. On the league's own site there is no
        "our", and every team in the table has an equal claim to it.
      */}
      <TableNote>
        How many matches each team has played and how many points they have. Most points at the top.
        {hasRecord ? null : " This is the league's own closing table, which records played and points only."}
      </TableNote>

      {/*
        `whitespace-normal` because a Badge is nowrap by design — it is for
        one or two words — and these are sentences. At 360px the abandoned
        notice was 396px wide and scrolled the whole page sideways, which
        only shows on the seasons the league never finished.
      */}
      {incomplete ? (
        <p className="mb-4">
          <Badge tone="neutral" className="whitespace-normal">
            {incomplete === "cancelled"
              ? "Season cancelled — never played"
              : "Season abandoned part-way through"}
          </Badge>
        </p>
      ) : null}

      <div className="hidden sm:block">
        <TableScroller>
          <thead>
            <tr>
              <Th className="w-14 text-right">Pos</Th>
              <Th>Team</Th>
              <Th className="text-right">Played</Th>
              {hasRecord ? (
                <>
                  <Th className="text-right">Won</Th>
                  <Th className="text-right">Drawn</Th>
                  <Th className="text-right">Lost</Th>
                </>
              ) : null}
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
                    <Link href={teamHref(row.teamSlug, season)} className="link">
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
                {hasRecord ? (
                  <>
                    <Td className="tabular text-right">{row.won ?? "—"}</Td>
                    <Td className="tabular text-right">{row.drawn ?? "—"}</Td>
                    <Td className="tabular text-right">{row.lost ?? "—"}</Td>
                  </>
                ) : null}
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
                    <Link href={teamHref(row.teamSlug, season)} className="link">
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
                {hasRecord
                  ? `Played ${row.played} · Won ${row.won ?? "—"} · Drawn ${row.drawn ?? "—"} · Lost ${row.lost ?? "—"}`
                  : `Played ${row.played}`}
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

/**
 * The averages, division by division, as the league prints them.
 *
 * Placings are awarded within a division, so one long table sorted by
 * percentage puts a Division Two player above a Premier one and quietly
 * implies a comparison the league never makes.
 */
export function AveragesByDivision({ stats }: { stats: PlayerStat[] }) {
  const divisions = DIVISION.filter((division) => stats.some((stat) => stat.division === division));
  const unplaced = stats.filter((stat) => !stat.division);

  if (stats.length === 0) {
    return (
      <Empty>
        No averages yet this season. They appear as soon as the first cards are entered — these are
        worked out from the match cards themselves, not typed in.
      </Empty>
    );
  }

  // One division and nothing else is not a grouping, it is a heading over
  // the only table on the page.
  if (divisions.length <= 1 && unplaced.length === 0) {
    return <AveragesTable stats={stats} />;
  }

  return (
    <div className="space-y-12">
      {divisions.map((division) => (
        <section key={division}>
          <h2 className="mb-3 text-2xl">{divisionLabel(division)}</h2>
          <AveragesTable stats={stats.filter((stat) => stat.division === division)} />
        </section>
      ))}
      {unplaced.length > 0 ? (
        <section>
          <h2 className="mb-3 text-2xl">No division recorded</h2>
          <AveragesTable stats={unplaced} />
        </section>
      ) : null}
    </div>
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
                <Td className="text-ink-muted">
                  {row.teamSlug && row.teamName ? (
                    <Link href={teamHref(row.teamSlug, row.seasonLabel)} className="link">
                      {row.teamName}
                    </Link>
                  ) : (
                    (row.teamName ?? "—")
                  )}
                </Td>
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
              <p className="text-ink-muted">
                {row.teamSlug && row.teamName ? (
                  <Link href={teamHref(row.teamSlug, row.seasonLabel)} className="link">
                    {row.teamName}
                  </Link>
                ) : (
                  (row.teamName ?? "No team recorded")
                )}
              </p>
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
                <Td className="text-ink-muted">
                  {row.teamSlug && row.teamName ? (
                    <Link href={teamHref(row.teamSlug, row.seasonLabel)} className="link">
                      {row.teamName}
                    </Link>
                  ) : (
                    (row.teamName ?? "—")
                  )}
                </Td>
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
              <p className="text-ink-muted">
                {row.teamSlug && row.teamName ? (
                  <Link href={teamHref(row.teamSlug, row.seasonLabel)} className="link">
                    {row.teamName}
                  </Link>
                ) : (
                  (row.teamName ?? "No team recorded")
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

// ---------------------------------------------------------------------------
// The season calendar, in two views
// ---------------------------------------------------------------------------

/**
 * How a week that is not a league match week is drawn.
 *
 * The league's own grid tints these columns — Thistle for a cup week,
 * Gainsboro for a free one — and spells "DivCup" vertically down the rows a
 * letter at a time. The tints are 1990s web-safe values and none of them
 * clears the 7:1 bar this site holds itself to, so the site's own accent
 * and sunken neutral stand in; the vertical lettering is not reproduced at
 * all, because a word written downwards is unreadable to a screen reader
 * and nearly so to everyone else. The label goes in the header once.
 */
const WEEK_TINT: Record<CalendarColumn["kind"], string> = {
  matches: "",
  // One tint for both, saying the one thing they have in common: no league
  // match this week. Two tints were tried and were not worth having. The
  // pair that reads as a pair — the accent and the neutral — differ by so
  // little side by side that December's cup final and the two free weeks
  // either side of it looked identical anyway; and pushing the accent far
  // enough apart to be seen dropped the muted text on it to 6.4:1 in the
  // dark theme, under this site's 7:1 floor. Which week it is, the header
  // says in words.
  cup: "bg-surface-sunken",
  free: "bg-surface-sunken",
};

/**
 * What to call a week in a heading.
 *
 * The league's labels are "Divisional", "Handicap" and "Finals", and only
 * the first two take "cup" after them — the third is the cup finals, and
 * "Finals cup" is not a thing anybody in the league says.
 */
function weekTitle(column: CalendarColumn): string {
  if (column.kind === "free") return "Free week";
  if (column.kind !== "cup") return "League matches";
  if (!column.label) return "Cup week";
  return /finals?/i.test(column.label) ? "Cup finals" : `${column.label} cup`;
}

/**
 * The one line a reader needs about a week nobody plays a league match in.
 *
 * The league says this in a tooltip, which is to say it does not say it to
 * anyone on a phone. A free week is not an empty week — it is the week your
 * postponed match goes in — and that is worth a sentence.
 */
function weekBlurb(column: CalendarColumn): string | null {
  if (column.note) return column.note;
  if (column.kind === "free") return "No league matches. Outstanding matches can be played.";
  if (column.kind === "cup") return "No league matches — cup night.";
  return null;
}

/**
 * One team's week in the grid.
 *
 * The league's own calendar distinguishes home from away by italicising
 * the away fixtures, with a line at the top of the page explaining that it
 * does. That is styling carrying meaning on its own, which fails for
 * anyone who cannot see it and for anyone who did not read the line — so
 * here the words say it: "v Kidston" at home, "at Kidston" away. The tint
 * is a second cue, never the only one.
 *
 * The night is under the opponent, in every cell. On the league's site it
 * is in the tooltip and nowhere else, and the column header shows the
 * Monday — so a reader on Cheshunt's row and a reader on Ellenborough's
 * read the same header and are three days apart.
 */
function CalendarCellContent({ cell, column }: { cell: CalendarCell; column: CalendarColumn }) {
  if (cell.entries.length === 0) {
    // In a cup or free column the header has already said why the cell is
    // empty, so the dash is a placeholder rather than information: hidden
    // from a screen reader, which would otherwise announce it seventy-two
    // times a season, and at full ink because muted text on the tint does
    // not clear this site's 7:1 bar in the dark theme.
    return column.kind === "matches" ? (
      <span className="text-ink-muted">No match</span>
    ) : (
      <span aria-hidden="true">—</span>
    );
  }

  return (
    <>
      {cell.entries.map(({ fixture, isHome, opponent }) => {
        const label = (
          <>
            <span className="text-ink-muted">{isHome ? "v" : "at"}</span> {opponent.name}
          </>
        );
        const night = nightOf(fixture);
        return (
          <span key={fixture.id} className="block">
            {fixture.status === "played" ? (
              <Link href={`/results/${fixture.id}`} className="link">
                {label}
              </Link>
            ) : (
              label
            )}
            {night && night !== column.weekCommencing ? (
              <span className="block text-ink-muted">{formatDateShort(night)}</span>
            ) : null}
          </span>
        );
      })}
    </>
  );
}

/**
 * The season at a glance — teams down the side, weeks across the top.
 *
 * This is the league's own grid, which the chronological fixture list does
 * not replace. A list answers "what is on this week"; a captain arranging a
 * rearrangement is asking "when are we free, and when do we play them", and
 * reading that off a list means scanning sixteen weeks for two mentions of
 * one team.
 *
 * Wide by nature, so the table scrolls sideways inside its own container
 * and the team column is sticky: scroll to March and you can still see
 * whose row you are on. Narrow screens get the week-by-week view instead,
 * which is the other half of why both exist.
 */
export function SeasonGrid({ segments }: { segments: CalendarSegment[] }) {
  if (segments.length === 0) {
    return (
      <Empty>
        There is no fixture programme for this division yet. It usually appears in August, before
        the season starts.
      </Empty>
    );
  }

  return (
    <div className="space-y-10">
      {segments.map((segment) => (
        <section key={segment.year} aria-label={`Fixtures in ${segment.year}`}>
          <h3 className="mb-3 text-xl">{segment.year}</h3>
          <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card print-plain">
            <table className="border-collapse text-left">
              <thead>
                <tr>
                  <th
                    scope="col"
                    className="sticky left-0 z-10 border-b border-r border-line bg-surface-sunken px-4 py-3 font-semibold text-ink"
                  >
                    Team
                  </th>
                  {segment.columns.map((column) => (
                    <th
                      scope="col"
                      key={column.weekCommencing}
                      className={cn(
                        "whitespace-nowrap border-b border-line px-4 py-3 text-left font-semibold text-ink",
                        column.kind === "matches" ? "bg-surface-sunken" : WEEK_TINT[column.kind],
                      )}
                    >
                      <span className="block">{formatDateShort(column.weekCommencing)}</span>
                      {column.kind === "matches" ? (
                        column.weekNumber ? (
                          <span className="block font-normal text-ink-muted">
                            Week {column.weekNumber}
                          </span>
                        ) : null
                      ) : (
                        // Named here once, rather than repeated down every
                        // row of a column in which nothing happens.
                        <span className="block font-normal text-ink-muted">
                          {weekTitle(column)}
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {segment.rows.map((row) => (
                  <tr key={row.team.slug} className="hover:bg-surface-sunken">
                    <th
                      scope="row"
                      className="sticky left-0 z-10 whitespace-nowrap border-b border-r border-line bg-surface px-4 py-3 text-left font-semibold"
                    >
                      {/* The grid is the fixture calendar, so a team's
                          name leads to that team's fixtures rather than
                          out of the calendar and into a profile. */}
                      <Link href={teamFixturesHref(row.team.slug)} className="link">
                        {row.team.name}
                      </Link>
                    </th>
                    {row.cells.map((cell, index) => {
                      const column = segment.columns[index]!;
                      return (
                        <td
                          key={column.weekCommencing}
                          className={cn(
                            "whitespace-nowrap border-b border-line px-4 py-3 align-top",
                            WEEK_TINT[column.kind],
                          )}
                        >
                          <CalendarCellContent cell={cell} column={column} />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}

/**
 * The same season as a diary — one block a week, matches under the night
 * they are played on.
 *
 * The grid is the season's shape; this is its sequence, and it is the view
 * that makes the league's hidden distinction impossible to miss. The week
 * is named for its Monday and the match is on the host club's own night,
 * so here the night is the heading and the fixture sits under it: you
 * cannot read one without reading the other.
 *
 * It is also the view that survives a phone. The grid is thirty-two columns
 * wide by nature and always will be.
 */
export function SeasonWeeks({ blocks }: { blocks: CalendarWeekBlock[] }) {
  if (blocks.length === 0) {
    return (
      <Empty>
        There is no fixture programme for this division yet. It usually appears in August, before
        the season starts.
      </Empty>
    );
  }

  return (
    <ol className="space-y-4">
      {blocks.map((block) => {
        const { column } = block;
        const blurb = weekBlurb(column);
        return (
          <li
            key={column.weekCommencing}
            className={cn(
              "rounded-card border border-line px-5 py-4 shadow-card print-plain",
              column.kind === "matches" ? "bg-surface" : WEEK_TINT[column.kind],
            )}
          >
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <h3 className="text-lg">
                {column.weekNumber ? `Week ${column.weekNumber}` : "Week"}
                <span className="font-normal text-ink-muted">
                  {" "}
                  commencing {formatDateShort(column.weekCommencing)}
                </span>
              </h3>
              {column.kind === "matches" ? null : <Badge tone="accent">{weekTitle(column)}</Badge>}
            </div>

            {blurb ? <p className="mt-1 text-ink-muted">{blurb}</p> : null}

            {block.nights.length > 0 ? (
              <div className="mt-3 space-y-3">
                {block.nights.map((night) => (
                  <div key={night.date}>
                    {/* The night, spelled out. This is the whole point of
                        the view: "Wednesday 23 September", not "w/c 21st". */}
                    <h4 className="font-semibold">{formatDateLong(night.date)}</h4>
                    <ul className="mt-1 space-y-1">
                      {night.entries.map(({ fixture, home, away }) => (
                        <li key={fixture.id} className="flex flex-wrap items-baseline gap-x-2">
                          <span>
                            {home.name} <span className="text-ink-muted">v</span> {away.name}
                          </span>
                          {fixture.status === "played" ? (
                            <Link href={`/results/${fixture.id}`} className="link">
                              {fixture.homeScore}–{fixture.awayScore}
                            </Link>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : null}

            {block.restingTeams.length > 0 ? (
              <p className="mt-3 text-ink-muted">
                No match this week:{" "}
                {block.restingTeams.map((team) => team.name).join(", ")}
              </p>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}

/**
 * A host club's standing message to visiting teams.
 *
 * Two of the ten clubs run one and both are about the hall's hours —
 * Furneux Pelham asking for a 7pm start, Water Lane explaining that the
 * hall goes at ten on a Wednesday and nine on a Friday. On the league's
 * own site these are the loudest thing on the page, in crimson inside a
 * red-bordered box, and rightly so: they are the difference between a
 * visiting side arriving in time to finish and not.
 *
 * Rendered on the club's page and on each of its teams', because a
 * visiting captain checking Thursday's match is on the team page, not the
 * club's. `clubName` is what makes that work — on a team page the note
 * has to say whose it is, or it reads as the league addressing you.
 *
 * Nothing renders without a note, so the eight clubs that have none carry
 * no empty box.
 */
export function VisitorNote({ note, clubName }: { note: string | null; clubName?: string | null }) {
  if (!note) return null;

  return (
    <Alert tone="warning" title={clubName ? `A note from ${clubName}` : "Please note"}>
      {/*
        Markdown, not plain text: the league bolds the closing time, which
        is the one fact in the sentence a captain has to act on, and the
        importer keeps that.
      */}
      <Prose markdown={note} className="max-w-readable" />
    </Alert>
  );
}
