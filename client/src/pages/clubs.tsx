import { ExternalLink, MapPin, Users } from "lucide-react";
import { Link } from "wouter";
import type { Club } from "@shared/types.js";
import { DIVISION, DIVISION_SHORT_LABELS } from "@shared/enums.js";
import { PageHeader, PrintButton } from "@/components/layout";
import { Badge, Card, Empty, ErrorNote, Loading, Prose, Stat, TableNote } from "@/components/ui";
import { GoogleMapsLink, VenueMap } from "@/components/map";
import { isGoogleMapsUrl } from "@/lib/maps";
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

  if (isLoading) return <Loading what="the clubs" variant="cards" />;
  if (isError) return <ErrorNote what="clubs" />;

  if (!clubs || clubs.length === 0) {
    return (
      <div>
        <PageHeader title="Clubs" subtitle="Every club in the league, and where they play" />
        <Empty>No clubs have been imported yet.</Empty>
      </div>
    );
  }

  const teamCount = clubs.reduce((total, club) => total + club.teamCount, 0);
  const playerCount = clubs.reduce((total, club) => total + club.playerCount, 0);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Clubs"
        subtitle="Every club in the league — where they play, which divisions their teams are in, and who turns out for them."
        actions={<PrintButton label="Print the club list" />}
      >
        <dl className="grid grid-cols-3 gap-3 sm:max-w-lg">
          <Stat value={clubs.length} label="clubs" />
          <Stat value={teamCount} label="teams" />
          <Stat value={playerCount} label="players" />
        </dl>
      </PageHeader>

      <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {clubs.map((club) => (
          <li key={club.id}>
            <ClubCard club={club} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClubCard({ club }: { club: Club }) {
  return (
    <Card className="flex h-full flex-col">
      <h2 className="text-xl">
        <Link href={`/clubs/${club.slug}`} className="link">
          {club.name}
        </Link>
      </h2>

      <p className="mt-1.5 flex items-start gap-2 text-ink-muted">
        <MapPin aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span>
          {club.venue ? (
            <>
              {club.venue.name}
              {club.venue.town ? `, ${club.venue.town}` : null}
            </>
          ) : (
            "No venue recorded"
          )}
        </span>
      </p>

      <p className="mt-1 flex items-start gap-2 text-ink-muted">
        <Users aria-hidden="true" className="mt-0.5 size-5 shrink-0" />
        <span className="tabular">
          {club.teamCount} {club.teamCount === 1 ? "team" : "teams"} · {club.playerCount}{" "}
          {club.playerCount === 1 ? "player" : "players"}
        </span>
      </p>

      {/*
        Short labels, and `nowrap` so a pill never breaks across lines on
        its own. `flex-wrap` stays as the safety net for the largest text
        setting, where three pills genuinely will not fit.
      */}
      {club.divisions.length > 0 ? (
        <p className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {DIVISION.filter((division) => club.divisions.includes(division)).map((division) => (
            <span key={division} className="whitespace-nowrap">
              <Badge>{DIVISION_SHORT_LABELS[division]}</Badge>
            </span>
          ))}
        </p>
      ) : null}
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function ClubPage({ slug }: { slug: string }) {
  const { data: club, isLoading, isError } = useClub(slug);

  if (isLoading) return <Loading what="this club" variant="page" />;
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
        actions={<PrintButton label="Print this club's details" />}
      />

      {club.description ? <Prose markdown={club.description} /> : null}

      {venue ? (
        <section aria-labelledby="where-heading">
          <h2 id="where-heading" className="mb-3 text-2xl">
            Where they play
          </h2>
          <Card className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <span
              aria-hidden="true"
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand"
            >
              <MapPin className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-lg font-semibold">{venue.name}</p>
              <address className="mt-1 not-italic text-ink-muted">
                {[venue.addressLine1, venue.addressLine2, venue.town, venue.postcode]
                  .filter(Boolean)
                  .map((line) => (
                    <span key={line} className="block">
                      {line}
                    </span>
                  ))}
              </address>
              <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                <Link href={`/play/venue/${venue.slug}`} className="link font-semibold">
                  Directions, parking and access
                </Link>
                {/*
                  The league's own `map_url`, but only where it goes
                  somewhere the Google Maps button below does not. Every
                  one currently stored is a Google search on the venue's
                  name, so this renders for none of them today — and the
                  field stays useful for a club that would rather send
                  people to a hall's own directions page.
                */}
                {venue.mapUrl && !isGoogleMapsUrl(venue.mapUrl) ? (
                  <a
                    href={venue.mapUrl}
                    className="link inline-flex items-center gap-1.5 font-semibold"
                    rel="noreferrer"
                  >
                    Open in maps
                    <ExternalLink aria-hidden="true" className="size-5" />
                  </a>
                ) : null}
              </p>
              <p className="mt-4">
                <GoogleMapsLink venue={venue} />
              </p>
            </div>
          </Card>

          {/*
            Under the address, not instead of it. The card above is the
            answer to "where is this"; the map is what makes it obvious
            whether that is somewhere you already know.
          */}
          <VenueMap
            pins={[{ venue, detail: club.name }]}
            className="mt-4 h-72"
            label={`Map showing ${venue.name}`}
          />
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
                  {/*
                    Every team links to its own page. These used to be
                    linked only for the site's "home club" — a flag that
                    made sense when this was one club's site and has been
                    false for every club since it became the league's, so
                    the effect was twenty-six teams rendered as plain text
                    beside twenty-six pages nobody could reach.
                  */}
                  <h3 className="text-xl">
                    <Link href={`/teams/${team.slug}`} className="link">
                      {team.name}
                    </Link>
                  </h3>
                  <p className="mt-1.5">
                    <Badge>{divisionLabel(team.division)}</Badge>
                  </p>
                  {team.homeNight ? (
                    <p className="mt-2 text-ink-muted">
                      At home on <strong className="text-ink">{formatDayName(team.homeNight)}s</strong>.
                    </p>
                  ) : null}
                  {team.captain ? (
                    <p className="mt-1 text-ink-muted">Captain: {team.captain.fullName}</p>
                  ) : null}
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
                  <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
                    {squad.players.map((player) => (
                      <li key={player.id}>
                        <Link href={`/players/${player.slug}`} className="link">
                          {player.displayName ?? player.fullName}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
