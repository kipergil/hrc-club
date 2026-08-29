import { Link } from "wouter";
import type { Club } from "@shared/types.js";
import { DIVISION, DIVISION_LABELS } from "@shared/enums.js";
import { PageHeader, PrintButton } from "@/components/layout";
import { Badge, Card, Empty, ErrorNote, Loading, Prose, TableNote } from "@/components/ui";
import { useClub, useClubs } from "@/lib/queries";
import { divisionLabel, formatDayName } from "@/lib/utils";

/**
 * The league has ten clubs and this site carries all of them, so an
 * opponent is a real page with an address and a squad rather than a name in
 * a fixture list. That is what makes "where are we playing on Thursday, and
 * is there parking" answerable without ringing someone.
 */
export function ClubsPage() {
  const { data: clubs, isLoading, isError } = useClubs();

  if (isLoading) return <Loading what="the clubs" />;
  if (isError) return <ErrorNote what="clubs" />;

  if (!clubs || clubs.length === 0) {
    return (
      <div>
        <PageHeader title="Clubs" subtitle="Every club in the league, and where they play" />
        <Empty>No clubs have been imported yet.</Empty>
      </div>
    );
  }

  // Ours first, then everyone else alphabetically — a visitor looking for
  // their own club scans the list, but a member looking for ours should not
  // have to.
  const home = clubs.filter((club) => club.isHomeClub);
  const rest = clubs.filter((club) => !club.isHomeClub);

  return (
    <div className="space-y-8">
      <PageHeader title="Clubs" subtitle="Every club in the league, and where they play">
        <PrintButton label="Print the club list" />
      </PageHeader>

      <TableNote>
        Ten clubs play in the Hertford &amp; District League. Each one’s page shows where they play,
        which divisions their teams are in, and who turns out for them.
      </TableNote>

      {home.length > 0 ? (
        <section aria-labelledby="ours-heading">
          <h2 id="ours-heading" className="mb-3 text-2xl">
            Our club
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {home.map((club) => (
              <li key={club.id}>
                <ClubCard club={club} />
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="others-heading">
        <h2 id="others-heading" className="mb-3 text-2xl">
          {home.length > 0 ? "The other clubs" : "Clubs"}
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rest.map((club) => (
            <li key={club.id}>
              <ClubCard club={club} />
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ClubCard({ club }: { club: Club }) {
  return (
    <Card className="h-full">
      <h3 className="text-xl">
        <Link href={`/clubs/${club.slug}`} className="text-brand underline underline-offset-4">
          {club.name}
        </Link>
      </h3>
      {club.venue ? (
        <p className="mt-1 text-ink-muted">
          {club.venue.name}
          {club.venue.town ? `, ${club.venue.town}` : null}
        </p>
      ) : (
        <p className="mt-1 text-ink-muted">No venue recorded</p>
      )}
      <p className="mt-3">
        {club.teamCount} {club.teamCount === 1 ? "team" : "teams"} · {club.playerCount}{" "}
        {club.playerCount === 1 ? "player" : "players"}
      </p>
      {club.divisions.length > 0 ? (
        <p className="mt-2 flex flex-wrap gap-2">
          {DIVISION.filter((division) => club.divisions.includes(division)).map((division) => (
            <Badge key={division}>{DIVISION_LABELS[division]}</Badge>
          ))}
        </p>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function ClubPage({ slug }: { slug: string }) {
  const { data: club, isLoading, isError } = useClub(slug);

  if (isLoading) return <Loading what="this club" />;
  if (isError || !club) return <ErrorNote what="club" />;

  const venue = club.venue;

  return (
    <div className="space-y-10">
      <PageHeader
        title={club.name}
        subtitle={
          venue
            ? `Plays at ${venue.name}${venue.town ? `, ${venue.town}` : ""}`
            : "A club in the Hertford & District League"
        }
      >
        {club.isHomeClub ? <Badge tone="positive">This is our club</Badge> : null}
      </PageHeader>

      {club.description ? <Prose markdown={club.description} /> : null}

      {venue ? (
        <section aria-labelledby="where-heading">
          <h2 id="where-heading" className="mb-3 text-2xl">
            Where they play
          </h2>
          <Card>
            <p className="text-lg font-semibold">{venue.name}</p>
            <address className="mt-2 not-italic">
              {[venue.addressLine1, venue.addressLine2, venue.town, venue.postcode]
                .filter(Boolean)
                .map((line) => (
                  <span key={line} className="block">
                    {line}
                  </span>
                ))}
            </address>
            <p className="mt-3 flex flex-wrap gap-4">
              {venue.mapUrl ? (
                <a href={venue.mapUrl} className="text-brand underline underline-offset-4" rel="noreferrer">
                  Open in maps
                </a>
              ) : null}
              <Link href={`/play/venue/${venue.slug}`} className="text-brand underline underline-offset-4">
                Directions, parking and access
              </Link>
            </p>
          </Card>
        </section>
      ) : null}

      <section aria-labelledby="teams-heading">
        <h2 id="teams-heading" className="mb-3 text-2xl">
          Teams
        </h2>
        {club.teams.length === 0 ? (
          <Empty>No teams are registered for this club this season.</Empty>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {club.teams.map((team) => (
              <li key={team.id}>
                <Card className="h-full">
                  <h3 className="text-xl">
                    {club.isHomeClub ? (
                      <Link href={`/teams/${team.slug}`} className="text-brand underline underline-offset-4">
                        {team.name}
                      </Link>
                    ) : (
                      team.name
                    )}
                  </h3>
                  <p className="mt-1">
                    <Badge>{divisionLabel(team.division)}</Badge>
                  </p>
                  {team.homeNight ? (
                    <p className="mt-2">
                      At home on <strong>{formatDayName(team.homeNight)}s</strong>.
                    </p>
                  ) : null}
                  {team.captain ? <p className="mt-1">Captain: {team.captain.fullName}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="players-heading">
        <h2 id="players-heading" className="mb-3 text-2xl">
          Players
        </h2>
        <TableNote>
          As registered with the league this season. A player can appear for more than one team.
        </TableNote>
        {club.squads.every((squad) => squad.players.length === 0) ? (
          <Empty>No players are registered for this club this season.</Empty>
        ) : (
          <div className="space-y-6">
            {club.squads
              .filter((squad) => squad.players.length > 0)
              .map((squad) => (
                <div key={squad.teamSlug}>
                  <h3 className="text-xl">{squad.teamName}</h3>
                  <ul className="mt-2 flex flex-wrap gap-x-6 gap-y-1">
                    {squad.players.map((player) => (
                      <li key={player.id}>
                        {club.isHomeClub ? (
                          <Link
                            href={`/players/${player.slug}`}
                            className="text-brand underline underline-offset-4"
                          >
                            {player.displayName ?? player.fullName}
                          </Link>
                        ) : (
                          (player.displayName ?? player.fullName)
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>

      <p>
        <Link href="/clubs" className="text-brand underline underline-offset-4">
          ← All clubs
        </Link>
      </p>
    </div>
  );
}
