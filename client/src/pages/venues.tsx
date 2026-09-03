import { Link } from "wouter";
import { MapPin as MapPinIcon } from "lucide-react";
import type { Club } from "@shared/types.js";
import { PageHeader, PrintButton } from "@/components/layout";
import { Card, Empty, ErrorNote, Loading, TableNote } from "@/components/ui";
import { GoogleMapsLink, VenueMap, type MapPin } from "@/components/map";
import { useClubs } from "@/lib/queries";
import { addressLines, hasPoint } from "@/lib/maps";

/**
 * Every hall in the league, on one map and in one list.
 *
 * The question this answers is the one the old site could not: a player
 * joining, or a captain working out whether an away match is an hour's
 * drive or ten minutes, wants to see where the league *is* before reading
 * ten addresses one club page at a time.
 *
 * The list is not a caption for the map — it is the page, and the map is
 * the illustration. Ordered so that anyone reading rather than looking
 * gets the same information in the same place, which is what makes this
 * work with the tiles blocked, the JavaScript off, or a screen reader on.
 */
export function VenuesPage() {
  const { data: clubs, isLoading, isError } = useClubs();

  if (isLoading) return <Loading what="the venues" variant="cards" />;
  if (isError) return <ErrorNote what="venues" />;

  /*
   * By venue rather than by club, because two clubs can share a hall and
   * two pins in the same spot is one pin the reader cannot click.
   */
  const byVenue = new Map<string, { venue: NonNullable<Club["venue"]>; clubs: Club[] }>();
  for (const club of clubs ?? []) {
    if (!club.venue) continue;
    const entry = byVenue.get(club.venue.id);
    if (entry) entry.clubs.push(club);
    else byVenue.set(club.venue.id, { venue: club.venue, clubs: [club] });
  }

  const venues = [...byVenue.values()].sort((a, b) => a.venue.name.localeCompare(b.venue.name));

  const pins: MapPin[] = venues.map(({ venue, clubs: at }) => ({
    venue,
    detail: at.map((club) => club.name).join(" and "),
    href: `/play/venue/${venue.slug}`,
  }));

  const missing = venues.filter(({ venue }) => !hasPoint(venue));

  if (venues.length === 0) {
    return (
      <div>
        <PageHeader title="Venues" subtitle="Every hall in the league" />
        <Empty>No venues have been recorded yet.</Empty>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Venues"
        subtitle={`All ${venues.length} halls in the league, from Bishop's Stortford to Enfield`}
        actions={<PrintButton label="Print the venue list" />}
      />

      <VenueMap pins={pins} className="h-[26rem]" label="Map of every venue in the league" />

      {missing.length > 0 ? (
        // Said plainly rather than left as a silently absent pin. A map
        // missing one of nine halls without saying so is a map that
        // quietly misleads whoever counts them.
        <TableNote>
          {missing.length === 1
            ? `${missing[0]!.venue.name} is not on the map yet — its address is in the list below.`
            : `${missing.length} halls are not on the map yet; their addresses are in the list below.`}
        </TableNote>
      ) : null}

      <section aria-labelledby="venue-list-heading">
        <h2 id="venue-list-heading" className="mb-3 text-2xl">
          Every hall, with its address
        </h2>
        <ul className="grid gap-4 sm:grid-cols-2">
          {venues.map(({ venue, clubs: at }) => (
            <li key={venue.id}>
              <Card className="flex h-full flex-col gap-3">
                <div className="flex gap-3">
                  <span
                    aria-hidden="true"
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand"
                  >
                    <MapPinIcon className="size-5" />
                  </span>
                  <div className="min-w-0">
                    <h3 className="text-lg font-semibold">
                      <Link href={`/play/venue/${venue.slug}`} className="link">
                        {venue.name}
                      </Link>
                    </h3>
                    <p className="text-ink-muted">
                      {at.map((club) => club.name).join(" and ")}
                    </p>
                    <address className="mt-2 not-italic text-ink-muted">
                      {addressLines(venue).map((line) => (
                        <span key={line} className="block">
                          {line}
                        </span>
                      ))}
                    </address>
                  </div>
                </div>
                <div className="mt-auto flex flex-wrap gap-3 pt-1">
                  <GoogleMapsLink venue={venue} />
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
