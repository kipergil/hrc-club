import { ExternalLink, MapPin } from "lucide-react";
import { Link } from "wouter";
import { PageHeader } from "@/components/layout";
import { Card, ErrorNote, Loading, Prose } from "@/components/ui";
import { useVenue } from "@/lib/queries";

/**
 * A hall, reached from the page of a club that plays there.
 *
 * This file used to hold two more pages — a "come and play" page and a
 * "join us" page listing membership fees. Both were written when this was
 * one club's site, neither has been routed since it became the league's,
 * and the fees they showed were placeholder. They are gone rather than
 * left to rot behind a dead import.
 */
export function VenuePage({ slug }: { slug: string }) {
  const { data: venue, isLoading, isError } = useVenue(slug);

  if (isLoading) return <Loading what="this venue" variant="page" />;
  if (isError || !venue) return <ErrorNote what="venue" />;

  const address = [venue.addressLine1, venue.addressLine2, venue.town, venue.postcode].filter(
    Boolean,
  );

  return (
    <div className="space-y-10">
      <PageHeader title={venue.name} subtitle="How to get here, where to park, and getting inside" />

      <Card className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <span
          aria-hidden="true"
          className="inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand"
        >
          <MapPin className="size-5" />
        </span>
        <div className="min-w-0">
          <h2 className="text-xl">Address</h2>
          <address className="mt-1 not-italic text-lg">
            {address.map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
          </address>
          {venue.tableCount ? (
            <p className="mt-2 text-ink-muted">
              {venue.tableCount} {venue.tableCount === 1 ? "table" : "tables"}.
            </p>
          ) : null}
          {venue.mapUrl ? (
            <p className="mt-3">
              <a
                href={venue.mapUrl}
                className="link inline-flex items-center gap-2 font-semibold"
                rel="noreferrer"
              >
                Open in maps
                <ExternalLink aria-hidden="true" className="size-5" />
              </a>
            </p>
          ) : null}
        </div>
      </Card>

      {venue.directions ? (
        <section>
          <h2 className="mb-2 text-2xl">Getting here</h2>
          <Prose markdown={venue.directions} />
        </section>
      ) : null}

      {venue.parkingNotes ? (
        <section>
          <h2 className="mb-2 text-2xl">Parking</h2>
          <Prose markdown={venue.parkingNotes} />
        </section>
      ) : null}

      {/*
        Access notes are given their own heading rather than being tucked
        into a general "about the venue" paragraph. Somebody who needs to
        know whether there are steps needs to find it without reading
        everything else first.
      */}
      <section>
        <h2 className="mb-2 text-2xl">Access</h2>
        {venue.accessibilityNotes ? (
          <Prose markdown={venue.accessibilityNotes} />
        ) : (
          <p className="max-w-readable text-ink-muted">
            We haven’t written up the access details for this hall yet.{" "}
            <Link href="/contact" className="link font-semibold">
              Ask us
            </Link>{" "}
            and we’ll tell you exactly what to expect.
          </p>
        )}
      </section>
    </div>
  );
}
