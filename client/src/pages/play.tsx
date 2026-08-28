import { Link } from "wouter";
import { DAY_OF_WEEK, SESSION_TYPE_LABELS } from "@shared/enums.js";
import { PageHeader, PrintButton } from "@/components/layout";
import { Alert, ButtonLink, Card, Empty, ErrorNote, Loading, Prose } from "@/components/ui";
import { useMembershipOptions, usePage, useSessions, useVenue, useVenues } from "@/lib/queries";
import { formatDayName, formatMoney, formatTime } from "@/lib/utils";
import { MEMBERSHIP_PERIOD_LABELS } from "@shared/enums.js";

/**
 * The most important page on the site.
 *
 * A person standing in a car park with a bat in their hand needs four
 * facts: which night, what time, which hall, and whether they can just turn
 * up. All four are above the fold, in the first card, in full sentences —
 * not in a table, not behind a tab, and not in a PDF.
 */
export function PlayPage() {
  const { data: sessions, isLoading, isError } = useSessions();
  const { data: venues } = useVenues();
  const homeVenue = venues?.find((venue) => venue.isHomeVenue) ?? venues?.[0];

  if (isLoading) return <Loading what="the club timetable" />;
  if (isError) return <ErrorNote what="timetable" />;

  const byDay = DAY_OF_WEEK.map((day) => ({
    day,
    sessions: (sessions ?? []).filter((session) => session.dayOfWeek === day),
  })).filter((group) => group.sessions.length > 0);

  return (
    <div className="space-y-10">
      <PageHeader title="When we play" subtitle="Club nights, times and what it costs">
        <PrintButton label="Print the timetable" />
      </PageHeader>

      {byDay.length === 0 ? (
        <Empty
          action={
            <ButtonLink href="/contact" variant="secondary">
              Ask us when we play
            </ButtonLink>
          }
        >
          The timetable hasn’t been published yet. Send us a message and we’ll tell you when the
          next session is.
        </Empty>
      ) : (
        <section aria-labelledby="timetable-heading">
          <h2 id="timetable-heading" className="mb-3 text-2xl">
            The week
          </h2>
          <ul className="space-y-4">
            {byDay.map((group) => (
              <li key={group.day}>
                <Card>
                  <h3 className="text-xl">{formatDayName(group.day)}</h3>
                  <ul className="mt-3 space-y-4">
                    {group.sessions.map((session) => (
                      <li key={session.id} className="border-t border-line pt-4 first:border-0 first:pt-0">
                        <p className="text-lg font-bold">
                          {session.name} · {formatTime(session.startTime)}
                          {session.endTime ? ` – ${formatTime(session.endTime)}` : null}
                        </p>
                        <p className="text-ink-muted">
                          {SESSION_TYPE_LABELS[session.sessionType] ?? session.sessionType}
                        </p>
                        {session.suitableFor ? (
                          <p className="mt-2">
                            <span className="font-semibold">Who it’s for: </span>
                            {session.suitableFor}
                          </p>
                        ) : null}
                        {session.costNote ? (
                          <p className="mt-1">
                            <span className="font-semibold">Cost: </span>
                            {session.costNote}
                          </p>
                        ) : null}
                        {session.venue ? (
                          <p className="mt-1">
                            <span className="font-semibold">Where: </span>
                            <Link
                              href={`/play/venue/${session.venue.slug}`}
                              className="text-brand underline underline-offset-4"
                            >
                              {session.venue.name}
                            </Link>
                          </p>
                        ) : null}
                        {session.leadCoachName ? (
                          <p className="mt-1">
                            <span className="font-semibold">Run by: </span>
                            {session.leadCoachName}
                          </p>
                        ) : null}
                        {session.notes ? (
                          <div className="mt-2">
                            <Prose markdown={session.notes} />
                          </div>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      )}

      {homeVenue ? (
        <section aria-labelledby="where-heading">
          <h2 id="where-heading" className="mb-3 text-2xl">
            Where to find us
          </h2>
          <VenueCard slug={homeVenue.slug} />
        </section>
      ) : null}

      <Alert title="Never played before?">
        <p>
          That’s fine — plenty of our members hadn’t either. Bring flat shoes and something you can
          move in; we’ll lend you a bat. Come along on a club night, or{" "}
          <Link href="/contact" className="text-brand underline">
            send us a message
          </Link>{" "}
          first if you’d rather someone was expecting you.
        </p>
      </Alert>
    </div>
  );
}

function VenueCard({ slug }: { slug: string }) {
  const { data: venue } = useVenue(slug);
  if (!venue) return null;

  return (
    <Card>
      <h3 className="text-xl">{venue.name}</h3>
      <address className="mt-2 not-italic">
        {[venue.addressLine1, venue.addressLine2, venue.town, venue.postcode]
          .filter(Boolean)
          .map((line) => (
            <span key={line} className="block">
              {line}
            </span>
          ))}
      </address>
      <p className="mt-3">
        <Link href={`/play/venue/${venue.slug}`} className="text-brand underline underline-offset-4">
          Directions, parking and access
        </Link>
      </p>
    </Card>
  );
}

// ---------------------------------------------------------------------------

export function VenuePage({ slug }: { slug: string }) {
  const { data: venue, isLoading, isError } = useVenue(slug);

  if (isLoading) return <Loading what="this venue" />;
  if (isError || !venue) return <ErrorNote what="venue" />;

  return (
    <div className="space-y-8">
      <PageHeader title={venue.name} subtitle="How to get here, where to park, and getting inside" />

      <Card>
        <h2 className="text-xl">Address</h2>
        <address className="mt-2 not-italic text-lg">
          {[venue.addressLine1, venue.addressLine2, venue.town, venue.postcode]
            .filter(Boolean)
            .map((line) => (
              <span key={line} className="block">
                {line}
              </span>
            ))}
        </address>
        {venue.mapUrl ? (
          <p className="mt-3">
            <a
              href={venue.mapUrl}
              className="text-brand underline underline-offset-4"
              rel="noreferrer"
            >
              Open in maps
            </a>
          </p>
        ) : null}
        {venue.tableCount ? (
          <p className="mt-3">
            {venue.tableCount} {venue.tableCount === 1 ? "table" : "tables"}.
          </p>
        ) : null}
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
      {venue.accessibilityNotes ? (
        <section>
          <h2 className="mb-2 text-2xl">Access</h2>
          <Prose markdown={venue.accessibilityNotes} />
        </section>
      ) : (
        <section>
          <h2 className="mb-2 text-2xl">Access</h2>
          <p className="max-w-prose text-ink-muted">
            We haven’t written up the access details for this hall yet.{" "}
            <Link href="/contact" className="text-brand underline">
              Ask us
            </Link>{" "}
            and we’ll tell you exactly what to expect.
          </p>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function JoinPage() {
  const { data: options } = useMembershipOptions();
  const { data: page } = usePage("join");

  return (
    <div className="space-y-10">
      <PageHeader title="Join us" subtitle="Membership, fees and how to start" />

      <Alert title="The short version">
        <p>
          Come to a club night, play, and see what you think. Nobody has to join on the first
          evening — pay the visitor rate, and sign up when you’re sure.
        </p>
      </Alert>

      {page?.body ? <Prose markdown={page.body} /> : null}

      {options && options.length > 0 ? (
        <section aria-labelledby="fees-heading">
          <h2 id="fees-heading" className="mb-3 text-2xl">
            Membership
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {options.map((option) => (
              <li key={option.id}>
                <Card className="h-full">
                  <h3 className="text-xl">{option.name}</h3>
                  <p className="mt-2 text-2xl font-bold tabular">
                    {formatMoney(option.pricePence)}{" "}
                    <span className="text-base font-normal text-ink-muted">
                      {MEMBERSHIP_PERIOD_LABELS[option.period] ?? option.period}
                    </span>
                  </p>
                  {option.includes ? (
                    <div className="mt-3">
                      <Prose markdown={option.includes} />
                    </div>
                  ) : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section aria-labelledby="next-heading">
        <h2 id="next-heading" className="mb-3 text-2xl">
          What to do next
        </h2>
        <div className="flex flex-wrap gap-4">
          <ButtonLink href="/contact">Send us a message</ButtonLink>
          <ButtonLink href="/play" variant="secondary">
            See when we play
          </ButtonLink>
        </div>
      </section>
    </div>
  );
}
