import { Link } from "wouter";
import { PageHeader, PrintButton } from "@/components/layout";
import { FixtureList } from "@/components/data";
import { Badge, Card, Empty, ErrorNote, Loading, Prose } from "@/components/ui";
import { usePlayer, usePlayers, useTeam, useTeams } from "@/lib/queries";
import { divisionLabel, fileUrl, formatDayName, formatTime } from "@/lib/utils";

export function TeamsPage() {
  const { data: teams, isLoading, isError } = useTeams();

  if (isLoading) return <Loading what="our teams" />;
  if (isError) return <ErrorNote what="teams" />;

  return (
    <div>
      <PageHeader title="Our teams" subtitle="Every HRC team, and who plays for them" />

      {!teams || teams.length === 0 ? (
        <Empty>
          No teams have been entered for this season yet. They usually go in once the league
          confirms the divisions in September.
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {teams.map((team) => (
            <li key={team.id}>
              <Card className="h-full">
                <h2 className="text-2xl">
                  <Link href={`/teams/${team.slug}`} className="text-brand underline underline-offset-4">
                    {team.name}
                  </Link>
                </h2>
                <p className="mt-1">
                  <Badge>{divisionLabel(team.division)}</Badge>
                </p>
                {team.homeNight ? (
                  <p className="mt-3">
                    Plays at home on <strong>{formatDayName(team.homeNight)}s</strong>
                    {team.homeStartTime ? ` at ${formatTime(team.homeStartTime)}` : null}.
                  </p>
                ) : null}
                {team.captain ? (
                  <p className="mt-1">
                    Captain: {team.captain.displayName ?? team.captain.fullName}
                  </p>
                ) : null}
                {team.homeVenue ? <p className="mt-1">{team.homeVenue.name}</p> : null}
                {team.description ? (
                  <div className="mt-3">
                    <Prose markdown={team.description} />
                  </div>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function TeamPage({ slug }: { slug: string }) {
  const { data: team, isLoading, isError } = useTeam(slug);

  if (isLoading) return <Loading what="this team" />;
  if (isError || !team) return <ErrorNote what="team" />;

  return (
    <div className="space-y-10">
      <PageHeader
        title={team.name}
        subtitle={`${divisionLabel(team.division)} · ${team.seasonLabel || "current season"}`}
      >
        <PrintButton label="Print this team's fixtures" />
      </PageHeader>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <h2 className="text-xl">Match nights</h2>
          {team.homeNight ? (
            <p className="mt-2">
              At home on <strong>{formatDayName(team.homeNight)}s</strong>
              {team.homeStartTime ? `, starting at ${formatTime(team.homeStartTime)}` : null}.
            </p>
          ) : (
            <p className="mt-2 text-ink-muted">Home night not recorded.</p>
          )}
          {team.homeVenue ? (
            <p className="mt-2">
              <Link
                href={`/play/venue/${team.homeVenue.slug}`}
                className="text-brand underline underline-offset-4"
              >
                {team.homeVenue.name}
              </Link>
            </p>
          ) : null}
        </Card>

        <Card>
          <h2 className="text-xl">Captain</h2>
          {team.captain ? (
            <p className="mt-2">
              <Link
                href={`/players/${team.captain.slug}`}
                className="text-brand underline underline-offset-4"
              >
                {team.captain.displayName ?? team.captain.fullName}
              </Link>
            </p>
          ) : (
            <p className="mt-2 text-ink-muted">No captain recorded for this season.</p>
          )}
        </Card>
      </div>

      {team.standing ? (
        <section aria-labelledby="position-heading">
          <h2 id="position-heading" className="mb-3 text-2xl">
            Where we stand
          </h2>
          <Card>
            <p className="text-lg">
              <strong>{team.standing.position}</strong> in {divisionLabel(team.division)}, with{" "}
              <strong>{team.standing.points}</strong> points from {team.standing.played} matches.
            </p>
            <p className="mt-2">
              <Link href="/tables" className="text-brand underline underline-offset-4">
                See the full table
              </Link>
            </p>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="squad-heading">
        <h2 id="squad-heading" className="mb-3 text-2xl">
          Squad
        </h2>
        {team.squad.length === 0 ? (
          <Empty>No players have been registered for this team yet.</Empty>
        ) : (
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {team.squad.map((place) => (
              <li key={place.id}>
                <Card>
                  <p className="text-lg font-semibold">
                    <Link
                      href={`/players/${place.member.slug}`}
                      className="text-brand underline underline-offset-4"
                    >
                      {place.member.displayName ?? place.member.fullName}
                    </Link>
                  </p>
                  {place.role !== "player" ? (
                    <p className="mt-1">
                      <Badge>{place.role === "vice_captain" ? "Vice captain" : place.role}</Badge>
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
        <FixtureList
          fixtures={team.fixtures}
          showTeam={false}
          emptyMessage="No matches left in the calendar for this team."
        />
      </section>

      <section aria-labelledby="history-heading">
        <h2 id="history-heading" className="mb-3 text-2xl">
          Match history
        </h2>
        <FixtureList
          fixtures={team.results}
          showTeam={false}
          showResult
          emptyMessage="This team hasn't played a match yet this season."
        />
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PlayersPage() {
  const { data: players, isLoading, isError } = usePlayers();

  if (isLoading) return <Loading what="our players" />;
  if (isError) return <ErrorNote what="players" />;

  return (
    <div>
      <PageHeader title="Players" subtitle="Everyone who turns out for the club" />

      {!players || players.length === 0 ? (
        <Empty>
          {/*
            An empty list here is far more likely to mean "nobody has opted
            in yet" than "the club has no players", and saying so is fairer
            to both the reader and the members.
          */}
          No player profiles are published at the moment. We only list a player once they’ve told us
          they’re happy to appear.
        </Empty>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {players.map((player) => (
            <li key={player.id}>
              <Card>
                <div className="flex items-center gap-4">
                  {fileUrl(player.photoId, { width: 96, height: 96, fit: "cover" }) ? (
                    <img
                      src={fileUrl(player.photoId, { width: 96, height: 96, fit: "cover" })!}
                      alt=""
                      width={48}
                      height={48}
                      className="size-12 rounded-full object-cover"
                    />
                  ) : null}
                  <div>
                    <p className="text-lg font-semibold">
                      <Link
                        href={`/players/${player.slug}`}
                        className="text-brand underline underline-offset-4"
                      >
                        {player.displayName ?? player.fullName}
                      </Link>
                    </p>
                    <p className="flex gap-2">
                      {player.isCoach ? <Badge tone="accent">Coach</Badge> : null}
                      {player.isCommittee ? <Badge>Committee</Badge> : null}
                    </p>
                  </div>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function PlayerPage({ slug }: { slug: string }) {
  const { data: player, isLoading, isError } = usePlayer(slug);

  if (isLoading) return <Loading what="this player" />;
  if (isError || !player) return <ErrorNote what="player profile" />;

  const photo = fileUrl(player.photoId, { width: 320, height: 320, fit: "cover" });

  return (
    <div className="space-y-10">
      <PageHeader
        title={player.displayName ?? player.fullName}
        subtitle={player.joinedYear ? `Playing for the club since ${player.joinedYear}` : "Club member"}
      />

      <div className="flex flex-wrap items-start gap-6">
        {photo ? (
          <img
            src={photo}
            alt={`${player.fullName}`}
            width={160}
            height={160}
            className="size-40 rounded-card object-cover"
          />
        ) : null}
        <div className="flex-1">
          {player.bio ? <Prose markdown={player.bio} /> : null}
          <p className="mt-3 flex gap-2">
            {player.isCoach ? <Badge tone="accent">Coach</Badge> : null}
            {player.isCommittee ? <Badge>Committee</Badge> : null}
          </p>
        </div>
      </div>

      {player.squadPlaces.length > 0 ? (
        <section aria-labelledby="teams-heading">
          <h2 id="teams-heading" className="mb-3 text-2xl">
            Teams
          </h2>
          <ul className="space-y-2">
            {player.squadPlaces.map((place, index) => (
              <li key={`${place.teamSlug}-${place.seasonLabel}-${index}`}>
                <Link href={`/teams/${place.teamSlug}`} className="text-brand underline underline-offset-4">
                  {place.teamName}
                </Link>{" "}
                <span className="text-ink-muted">
                  · {place.seasonLabel}
                  {place.role !== "player" ? ` · ${place.role.replace("_", " ")}` : null}
                </span>
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
          <ul className="grid gap-3 sm:grid-cols-2">
            {player.stats.map((stat) => (
              <li key={stat.id}>
                <Card>
                  <p className="text-lg font-bold">{stat.seasonLabel}</p>
                  <p className="text-ink-muted">{stat.teamName ?? "No team recorded"}</p>
                  <p className="mt-2 tabular">
                    Played {stat.played} · Won {stat.won} · Lost {stat.lost}
                    {stat.winPercentage === null ? null : ` · ${Math.round(stat.winPercentage)}%`}
                  </p>
                  {stat.handicap !== null ? (
                    <p className="mt-1 tabular">Handicap {stat.handicap}</p>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {player.honours.length > 0 ? (
        <section aria-labelledby="honours-heading">
          <h2 id="honours-heading" className="mb-3 text-2xl">
            Honours
          </h2>
          <ul className="space-y-2">
            {player.honours.map((honour) => (
              <li key={honour.id}>
                <strong>{honour.seasonLabel}</strong> · {honour.title}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
