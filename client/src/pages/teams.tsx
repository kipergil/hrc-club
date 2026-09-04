import { CalendarDays, MapPin, Users } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { DIVISION } from "@shared/enums.js";
import type { Division } from "@shared/enums.js";
import { PageHeader, PrintButton } from "@/components/layout";
import { TeamFixtureList, VisitorNote } from "@/components/data";
import {
  Badge,
  Card,
  Empty,
  ErrorNote,
  FilterChips,
  Loading,
  Pagination,
  Prose,
  SearchBox,
  Stat,
  TableNote,
  TableScroller,
  Td,
  Th,
  Tr,
  usePagination,
} from "@/components/ui";
import { usePlayer, usePlayers, useSeasons, useTeam, useTeams } from "@/lib/queries";
import { SeasonPicker, useSeasonParam } from "@/components/season";
import { divisionLabel, fileUrl, formatDateShort, formatDayName, formatTime } from "@/lib/utils";

export function TeamsPage() {
  const { data: teams, isLoading, isError } = useTeams();
  const [division, setDivision] = useState<Division | "all">("all");

  const all = useMemo(() => teams ?? [], [teams]);

  // Grouped by division and in the league's own order, because "which
  // division is that team in" is the question this page exists to answer.
  const divisions = useMemo(
    () => DIVISION.filter((value) => all.some((team) => team.division === value)),
    [all],
  );

  const shown = division === "all" ? all : all.filter((team) => team.division === division);

  if (isLoading) return <Loading what="the teams" variant="cards" />;
  if (isError) return <ErrorNote what="teams" />;

  if (all.length === 0) {
    return (
      <div>
        <PageHeader title="Teams" subtitle="Every team in the league, by division" />
        <Empty>
          No teams have been entered for this season yet. They usually go in once the league
          confirms the divisions in September.
        </Empty>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      <PageHeader title="Teams" subtitle="Every team in the league, by division">
        {divisions.length > 1 ? (
          <FilterChips
            label="Division"
            value={division}
            onChange={setDivision}
            options={[
              { value: "all" as const, label: "All divisions", count: all.length },
              ...divisions.map((value) => ({
                value,
                label: divisionLabel(value),
                count: all.filter((team) => team.division === value).length,
              })),
            ]}
          />
        ) : null}
      </PageHeader>

      {(division === "all" ? divisions : [division]).map((value) => {
        const inDivision = shown.filter((team) => team.division === value);
        if (inDivision.length === 0) return null;

        return (
          <section key={value} aria-label={divisionLabel(value)}>
            <h2 className="mb-3 text-2xl">{divisionLabel(value)}</h2>
            <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {inDivision.map((team) => (
                <li key={team.id}>
                  <Card className="flex h-full flex-col">
                    <h3 className="text-xl">
                      <Link href={`/teams/${team.slug}`} className="link">
                        {team.name}
                      </Link>
                    </h3>
                    {team.clubSlug ? (
                      <p className="mt-0.5">
                        <Link href={`/clubs/${team.clubSlug}`} className="link text-ink-muted">
                          {team.clubName}
                        </Link>
                      </p>
                    ) : null}

                    <dl className="mt-3 space-y-1.5 text-ink-muted">
                      {team.homeNight ? (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">Home night</dt>
                          <CalendarDays aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                          <dd>
                            {formatDayName(team.homeNight)}s
                            {team.homeStartTime ? `, ${formatTime(team.homeStartTime)}` : null}
                          </dd>
                        </div>
                      ) : null}
                      {team.homeVenue ? (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">Home venue</dt>
                          <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                          <dd>{team.homeVenue.name}</dd>
                        </div>
                      ) : null}
                      {team.captain ? (
                        <div className="flex items-start gap-2">
                          <dt className="sr-only">Captain</dt>
                          <Users aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
                          <dd>{team.captain.displayName ?? team.captain.fullName}</dd>
                        </div>
                      ) : null}
                    </dl>

                    {team.description ? (
                      <div className="mt-3">
                        <Prose markdown={team.description} />
                      </div>
                    ) : null}
                  </Card>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TeamPage({ slug }: { slug: string }) {
  const { data: seasons } = useSeasons();
  const [season, setSeason] = useSeasonParam();
  const { data: team, isLoading, isError } = useTeam(slug, season);

  if (isLoading) return <Loading what="this team" variant="page" />;
  if (isError || !team) return <ErrorNote what="team" />;

  return (
    <div className="space-y-10">
      <PageHeader
        title={team.name}
        subtitle={`${divisionLabel(team.division)} · ${team.seasonLabel || "current season"}`}
        actions={<PrintButton label="Print this team's fixtures" />}
      >
        {/*
          A team's row exists once per season, so switching year here is
          switching to a different record — which is what makes a promotion
          history rather than an overwrite.
        */}
        <SeasonPicker seasons={seasons} value={season ?? team.seasonLabel} onChange={setSeason} />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <h2 className="font-semibold uppercase tracking-wide text-ink-muted">Match nights</h2>
          {team.homeNight ? (
            <p className="mt-1 text-lg">
              At home on <strong>{formatDayName(team.homeNight)}s</strong>
              {team.homeStartTime ? `, from ${formatTime(team.homeStartTime)}` : null}.
            </p>
          ) : (
            <p className="mt-1 text-ink-muted">Home night not recorded.</p>
          )}
          {team.homeVenue ? (
            <p className="mt-2">
              <Link href={`/play/venue/${team.homeVenue.slug}`} className="link">
                {team.homeVenue.name}
              </Link>
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="font-semibold uppercase tracking-wide text-ink-muted">Captain</h2>
          {team.captain ? (
            <p className="mt-1 text-lg">
              <Link href={`/players/${team.captain.slug}`} className="link">
                {team.captain.displayName ?? team.captain.fullName}
              </Link>
            </p>
          ) : (
            <p className="mt-1 text-ink-muted">No captain recorded for this season.</p>
          )}
        </Card>

        {team.standing ? (
          <Card>
            <h2 className="font-semibold uppercase tracking-wide text-ink-muted">
              In {divisionLabel(team.division)}
            </h2>
            <p className="mt-1 text-lg">
              <strong className="tabular">{team.standing.position}</strong> with{" "}
              <strong className="tabular">{team.standing.points}</strong> points from{" "}
              <span className="tabular">{team.standing.played}</span> matches.
            </p>
            <p className="mt-2">
              <Link href="/tables" className="link">
                See the full table
              </Link>
            </p>
          </Card>
        ) : null}
      </div>

      {/*
        Straight after the match-night card, because it qualifies it. A
        visiting captain reads "at home on Wednesdays, from 7:30" and then
        the club's own "we have the hall from 7pm til 10pm" — which is the
        order those two have to be in for the second to land.
      */}
      <VisitorNote note={team.clubVisitorNote} clubName={team.clubName} />

      <section aria-labelledby="squad-heading">
        <h2 id="squad-heading" className="mb-3 text-2xl">
          Squad
        </h2>
        {team.squad.length === 0 ? (
          <Empty>No players have been registered for this team yet.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {team.squad.map((place) => (
              <li key={place.id}>
                <Card className="h-full">
                  <p className="font-semibold">
                    <Link href={`/players/${place.member.slug}`} className="link">
                      {place.member.displayName ?? place.member.fullName}
                    </Link>
                  </p>
                  {place.role !== "player" ? (
                    <p className="mt-1.5">
                      <Badge tone="brand">
                        {place.role === "vice_captain" ? "Vice captain" : place.role}
                      </Badge>
                    </p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="fixtures-heading">
        <h2 id="fixtures-heading" className="mb-3 text-2xl">
          Still to play
        </h2>
        <TeamFixtureList
          fixtures={team.fixtures}
          emptyMessage="No matches left in the calendar for this team."
        />
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-2xl">
          Match history
        </h2>
        <TeamFixtureList
          fixtures={team.results}
          emptyMessage="This team hasn't played a match yet this season."
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PlayersPage() {
  const { data: players, isLoading, isError } = usePlayers();
  const [query, setQuery] = useState("");

  const all = useMemo(() => players ?? [], [players]);

  /*
   * 165 players in one alphabetical grid. Without a search box, finding
   * one meant scrolling a page of eighty-odd kilobytes or falling back on
   * the browser's own find — which is exactly the sort of thing the league
   * audit criticised the old site for expecting of people.
   */
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return all;
    return all.filter((player) =>
      `${player.fullName} ${player.displayName ?? ""}`.toLowerCase().includes(needle),
    );
  }, [all, query]);

  const paged = usePagination(filtered, 24, query);

  if (isLoading) return <Loading what="the players" variant="cards" />;
  if (isError) return <ErrorNote what="players" />;

  if (all.length === 0) {
    return (
      <div>
        <PageHeader title="Players" subtitle="Everyone registered with a club this season" />
        <Empty>
          {/*
            An empty list here is far more likely to mean "nobody has opted
            in yet" than "the league has no players", and saying so is
            fairer to both the reader and the members.
          */}
          No players are listed at the moment. Players appear here once their club has registered
          them with the league.
        </Empty>
      </div>
    );
  }

  return (
    <div>
      <PageHeader title="Players" subtitle="Everyone registered with a club this season">
        <SearchBox
          label="Find a player"
          placeholder="Type a name"
          value={query}
          onChange={setQuery}
          resultCount={{ shown: filtered.length, total: all.length, noun: "players" }}
        />
      </PageHeader>

      {filtered.length === 0 ? (
        <Empty>
          Nobody registered this season matches “{query}”. Try a surname on its own — players are
          listed under the name their club registered them with.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {paged.items.map((player) => {
            const photo = fileUrl(player.photoId, { width: 96, height: 96, fit: "cover" });
            return (
              <li key={player.id}>
                <Card className="h-full">
                  <div className="flex items-center gap-3">
                    {photo ? (
                      <img
                        src={photo}
                        alt=""
                        width={48}
                        height={48}
                        className="size-12 shrink-0 rounded-full object-cover"
                      />
                    ) : (
                      /* A neutral initial rather than a generic silhouette,
                         which reads as a missing image. */
                      <span
                        aria-hidden="true"
                        className="flex size-12 shrink-0 items-center justify-center rounded-full bg-surface-sunken font-semibold text-ink-muted"
                      >
                        {(player.displayName ?? player.fullName).charAt(0)}
                      </span>
                    )}
                    <div className="min-w-0">
                      <p className="font-semibold">
                        <Link href={`/players/${player.slug}`} className="link">
                          {player.displayName ?? player.fullName}
                        </Link>
                      </p>
                      {player.isCoach || player.isCommittee ? (
                        <p className="mt-1 flex flex-wrap gap-1.5">
                          {player.isCoach ? <Badge tone="accent">Coach</Badge> : null}
                          {player.isCommittee ? <Badge>Committee</Badge> : null}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {filtered.length > 0 ? <Pagination state={paged} noun="players" /> : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PlayerPage({ slug }: { slug: string }) {
  const [season, setSeason] = useSeasonParam();
  const { data: seasons } = useSeasons();
  const { data: player, isLoading, isError } = usePlayer(slug, season);

  /*
   * The season's record, worked out from the cards rather than read from
   * `hrc_player_stats`.
   *
   * That table only holds imported seasons, so a player with twenty-four
   * rubbers entered this year had an empty "Playing record" — the profile
   * showed which team they were in and nothing about how they had done.
   * Singles only, which is the league's own rule for averages: the doubles
   * is a pair's result, not a player's.
   *
   * Every hook runs before the guards below, which is not decoration —
   * `scripts/hook-order.test.ts` exists because a conditional hook here
   * blanks the whole route rather than degrading.
   */
  const record = useMemo(() => {
    const singles = (player?.rubbers ?? []).filter((rubber) => rubber.kind === "singles");
    const won = singles.filter((rubber) => rubber.won).length;
    return {
      played: singles.length,
      won,
      lost: singles.length - won,
      percentage: singles.length === 0 ? null : Math.round((won / singles.length) * 100),
    };
  }, [player]);

  if (isLoading) return <Loading what="this player" variant="page" />;
  if (isError || !player) return <ErrorNote what="player profile" />;

  const photo = fileUrl(player.photoId, { width: 320, height: 320, fit: "cover" });
  const shownSeason =
    player.rubbers[0]?.seasonLabel ??
    season ??
    seasons?.find((one) => one.isCurrent)?.label ??
    "this season";

  return (
    <div className="space-y-10">
      <PageHeader
        title={player.displayName ?? player.fullName}
        subtitle={
          player.joinedYear ? `Playing in the league since ${player.joinedYear}` : "League member"
        }
      >
        <SeasonPicker seasons={seasons} value={season} onChange={setSeason} />
      </PageHeader>

      {photo || player.bio || player.isCoach || player.isCommittee ? (
        <div className="flex flex-wrap items-start gap-6">
          {photo ? (
            <img
              src={photo}
              alt={player.fullName}
              width={160}
              height={160}
              className="size-40 rounded-card object-cover shadow-card"
            />
          ) : null}
          <div className="min-w-0 flex-1">
            {player.bio ? <Prose markdown={player.bio} /> : null}
            {player.isCoach || player.isCommittee ? (
              <p className="mt-3 flex flex-wrap gap-2">
                {player.isCoach ? <Badge tone="accent">Coach</Badge> : null}
                {player.isCommittee ? <Badge>Committee</Badge> : null}
              </p>
            ) : null}
          </div>
        </div>
      ) : null}

      {player.squadPlaces.length > 0 ? (
        <section aria-labelledby="teams-heading">
          <h2 id="teams-heading" className="mb-3 text-2xl">
            Teams
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {player.squadPlaces.map((place, index) => (
              <li key={`${place.teamSlug}-${place.seasonLabel}-${index}`}>
                <Card>
                  <p className="font-semibold">
                    <Link href={`/teams/${place.teamSlug}`} className="link">
                      {place.teamName}
                    </Link>
                  </p>
                  <p className="mt-0.5 text-ink-muted">
                    {place.seasonLabel}
                    {place.role !== "player" ? ` · ${place.role.replace("_", " ")}` : null}
                  </p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {player.stats.length > 0 ? (
        <section aria-labelledby="record-heading">
          <h2 id="record-heading" className="mb-3 text-2xl">
            Playing record
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {player.stats.map((stat) => (
              <li key={stat.id}>
                <Card className="h-full">
                  <p className="font-semibold">{stat.seasonLabel}</p>
                  <p className="text-ink-muted">{stat.teamName ?? "No team recorded"}</p>
                  <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                    <div>
                      <dd className="text-xl font-semibold tabular">{stat.played}</dd>
                      <dt className="text-ink-muted">played</dt>
                    </div>
                    <div>
                      <dd className="text-xl font-semibold tabular text-positive">{stat.won}</dd>
                      <dt className="text-ink-muted">won</dt>
                    </div>
                    <div>
                      <dd className="text-xl font-semibold tabular">
                        {stat.winPercentage === null ? "—" : `${Math.round(stat.winPercentage)}%`}
                      </dd>
                      <dt className="text-ink-muted">win rate</dt>
                    </div>
                  </dl>
                  {stat.handicap !== null ? (
                    <p className="mt-3 tabular text-ink-muted">Handicap {stat.handicap}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {player.rubbers.length > 0 ? (
        <section aria-labelledby="season-record-heading">
          <h2 id="season-record-heading" className="mb-3 text-2xl">
            {shownSeason} record
          </h2>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Card>
              <dd className="text-2xl font-semibold tabular">{record.played}</dd>
              <dt className="text-ink-muted">singles played</dt>
            </Card>
            <Card>
              <dd className="text-2xl font-semibold tabular text-positive">{record.won}</dd>
              <dt className="text-ink-muted">won</dt>
            </Card>
            <Card>
              <dd className="text-2xl font-semibold tabular">{record.lost}</dd>
              <dt className="text-ink-muted">lost</dt>
            </Card>
            <Card>
              <dd className="text-2xl font-semibold tabular">
                {record.percentage === null ? "—" : `${record.percentage}%`}
              </dd>
              <dt className="text-ink-muted">win rate</dt>
            </Card>
          </dl>
          {/*
            The doubles is excluded from the figures above but kept in the
            table below, because it is a rubber they played — the league
            simply does not count it in an average.
          */}
          <p className="mt-2 text-ink-muted">
            Worked out from the match cards. The doubles is listed below but not counted, which is
            how the league keeps its averages.
          </p>
        </section>
      ) : null}

      {player.rubbers.length > 0 ? (
        <section aria-labelledby="rubbers-heading">
          <h2 id="rubbers-heading" className="mb-3 text-2xl">
            Every singles and doubles in {shownSeason}
          </h2>
          {/*
            Built from the match cards rather than stored, so it appears
            the moment a card is entered and can never disagree with one.
            Read from this player's side: "11-8" is a game they won,
            whichever end of the table they were at.
          */}
          <TableNote>
            {(() => {
              const won = player.rubbers.filter((rubber) => rubber.won).length;
              // "including the doubles" earns its place: this count sits
              // directly under a record card that says 13 won, and the
              // difference between the two numbers is the doubles.
              return `Won ${won} of the ${player.rubbers.length} played, including the doubles. Game scores are from ${player.displayName ?? player.fullName}'s side.`;
            })()}
          </TableNote>
          <TableScroller>
            <thead>
              <tr>
                <Th>Match</Th>
                <Th>Opponent</Th>
                <Th className="text-right">Sets</Th>
                <Th>Result</Th>
              </tr>
            </thead>
            <tbody>
              {player.rubbers.map((rubber) => (
                <Tr key={`${rubber.fixtureId}-${rubber.rubberNumber}`}>
                  <Td>
                    <Link href={`/results/${rubber.fixtureId}`} className="link font-semibold">
                      {/* "at" rather than "v" when they were away, so the
                          row does not read as a home fixture it was not. */}
                      {rubber.team.name} {rubber.isHome ? "v" : "at"} {rubber.opponentTeam.name}
                    </Link>
                    <span className="block text-ink-muted">
                      {formatDateShort(rubber.playedOn)}
                      {rubber.kind === "doubles" ? " · doubles" : ""}
                      {rubber.partner ? ` with ${rubber.partner.name}` : ""}
                    </span>
                  </Td>
                  <Td>
                    {rubber.opponents.map((opponent, index) => (
                      <span key={`${opponent.name}-${index}`}>
                        {index > 0 ? <span className="text-ink-muted"> &amp; </span> : null}
                        {opponent.slug ? (
                          <Link href={`/players/${opponent.slug}`} className="link">
                            {opponent.name}
                          </Link>
                        ) : (
                          opponent.name
                        )}
                      </span>
                    ))}
                  </Td>
                  <Td className="whitespace-nowrap text-right">
                    <span className="tabular font-semibold">
                      {rubber.setsFor}–{rubber.setsAgainst}
                    </span>
                    {rubber.games.length > 0 ? (
                      <span className="block text-ink-muted">
                        {rubber.games.map(([a, b]) => `${a}-${b}`).join(", ")}
                      </span>
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

      {player.rubbers.length === 0 ? (
        <section aria-labelledby="no-rubbers-heading">
          <h2 id="no-rubbers-heading" className="mb-3 text-2xl">
            {shownSeason} record
          </h2>
          <Empty>
            No cards have been entered for {player.displayName ?? player.fullName} in {shownSeason}.
            Games appear here as captains enter their match cards.
          </Empty>
        </section>
      ) : null}

      {player.honours.length > 0 ? (
        <section aria-labelledby="honours-heading">
          <h2 id="honours-heading" className="mb-3 text-2xl">
            Honours
          </h2>
          <ul className="max-w-readable space-y-2">
            {player.honours.map((honour) => (
              <li key={honour.id} className="flex gap-3">
                <span className="font-semibold tabular">{honour.seasonLabel}</span>
                <span>{honour.title}</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
