import {
  ArrowRight,
  CalendarDays,
  ClipboardList,
  FileText,
  Table2,
  Trophy,
  Users,
} from "lucide-react";
import { Link } from "wouter";
import { FixtureList } from "@/components/data";
import { Card, CardLink, ErrorNote, Loading, Stat } from "@/components/ui";
import { useHome } from "@/lib/queries";
import { formatDateShort } from "@/lib/utils";

/**
 * The home page's job is orientation: who this is, how big, and the six
 * places people actually go.
 *
 * Deliberately not: a carousel, an auto-playing video, or a wall of links.
 * The league audit found the old home page carried twenty-odd links of
 * equal weight, which is the same as carrying none.
 *
 * The rebuild's own version had a subtler version of the same fault. The
 * masthead already gives the league's name and strapline; the page then
 * repeated both verbatim as an h1 and a lead, and followed them with five
 * paragraphs of history — so the first screenful was the league's name
 * three times over and nothing a reader could act on. The name stays (it
 * is the page's real heading, and search engines read it), but it is set
 * once, the description is cut to its opening sentence with the rest on
 * the About page, and the space that buys goes to the fixtures.
 */
export default function HomePage() {
  const { data, isLoading, isError } = useHome();

  if (isLoading) return <Loading what="the league's news and fixtures" variant="page" />;
  if (isError || !data) return <ErrorNote what="home page" />;

  const { settings, nextFixtures, latestResults, news, events, counts } = data;

  // The league's description runs to five paragraphs of history and
  // affiliations. The first is the one that orients a stranger; the rest
  // is what the About page is for.
  const [lead] = (settings.aboutSummary ?? "").split(/\n{2,}/).filter(Boolean);

  return (
    <div className="space-y-14">
      <section className="border-b border-line pb-10">
        {/*
          Set at the same size as every other page's title, not larger.
          The masthead two inches above already carries these words, so a
          display-sized copy of them is the page shouting its own name —
          and it pushed the first useful thing below the fold.
        */}
        <h1 className="text-2xl sm:text-3xl">{settings.clubName}</h1>
        {lead ? <p className="mt-3 max-w-readable text-lg text-ink-muted">{lead}</p> : null}

        <p className="mt-5">
          <Link href="/about" className="link inline-flex items-center gap-1.5 font-semibold">
            More about the league
            <ArrowRight aria-hidden="true" className="size-5" />
          </Link>
        </p>

        {/*
          Counted from the data rather than typed into a sentence, so the
          day an eleventh club joins the page is right without an edit.
        */}
        {/*
          Each tile leads to the thing it counts. They read as facts about
          the league, but every one of them is the answer to a question
          with a page behind it — "ten clubs, where?" — and a figure that
          cannot be followed makes the reader go and find the menu.

          The years tile leads to the history rather than to nothing: it
          is the one number here that is not a list.
        */}
        <dl className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat
            value={counts.clubs}
            label={counts.clubs === 1 ? "club" : "clubs"}
            href="/clubs"
          />
          <Stat
            value={counts.teams}
            label={counts.teams === 1 ? "team" : "teams"}
            href="/teams"
          />
          <Stat
            value={counts.venues}
            label={counts.venues === 1 ? "venue" : "venues"}
            href="/venues"
          />
          {settings.foundedYear ? (
            <Stat
              value={new Date().getFullYear() - settings.foundedYear}
              label="years of play"
              href="/about/history"
            />
          ) : null}
        </dl>
      </section>

      <section aria-labelledby="find-heading">
        <h2 id="find-heading" className="sr-only">
          Find what you came for
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardLink
            href="/fixtures"
            icon={<CalendarDays aria-hidden="true" className="size-6" />}
            title="This week's matches"
            description="Every match still to play, across all divisions."
            meta={
              nextFixtures[0]
                ? `${formatDateShort(nextFixtures[0].playedOn)} · ${nextFixtures[0].homeTeam.name} v ${nextFixtures[0].awayTeam.name}`
                : undefined
            }
          />
          <CardLink
            href="/results"
            icon={<ClipboardList aria-hidden="true" className="size-6" />}
            title="Latest results"
            description="Every match played, with the scorecards."
            meta={
              latestResults[0]
                ? `${latestResults[0].homeTeam.name} ${latestResults[0].homeScore ?? "?"}–${latestResults[0].awayScore ?? "?"} ${latestResults[0].awayTeam.name}`
                : undefined
            }
          />
          <CardLink
            href="/tables"
            icon={<Table2 aria-hidden="true" className="size-6" />}
            title="League tables"
            description="Who is top of each division, and how the season is going."
          />
          <CardLink
            href="/clubs"
            icon={<Users aria-hidden="true" className="size-6" />}
            title="Clubs and teams"
            description="Where every club plays, their teams and their players."
            meta={`${counts.clubs} clubs · ${counts.teams} teams`}
          />
          <CardLink
            href="/documents"
            icon={<FileText aria-hidden="true" className="size-6" />}
            title="Forms and documents"
            description="The handbook, the constitution, scorecards and forms."
          />
          <CardLink
            href="/honours"
            icon={<Trophy aria-hidden="true" className="size-6" />}
            title="Roll of honour"
            description="Champions and cup winners, going back generations."
            meta={counts.honoursFrom ? `Back to ${counts.honoursFrom}` : undefined}
          />
        </div>
      </section>

      <div className="grid gap-10 lg:grid-cols-2">
        <section aria-labelledby="next-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="next-heading" className="text-2xl">
              Next matches
            </h2>
            <Link href="/fixtures" className="link shrink-0 font-semibold">
              All fixtures
            </Link>
          </div>
          <FixtureList
            fixtures={nextFixtures}
            emptyMessage="There are no matches in the calendar at the moment. Fixtures for the new season usually appear in September."
          />
        </section>

        <section aria-labelledby="results-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="results-heading" className="text-2xl">
              Latest results
            </h2>
            <Link href="/results" className="link shrink-0 font-semibold">
              All results
            </Link>
          </div>
          <FixtureList
            fixtures={latestResults}
            emptyMessage="No results yet this season. They will appear here as soon as matches have been played."
          />
        </section>
      </div>

      {news.length > 0 ? (
        <section aria-labelledby="news-heading">
          <div className="mb-3 flex items-baseline justify-between gap-4">
            <h2 id="news-heading" className="text-2xl">
              Special notices
            </h2>
            <Link href="/news" className="link shrink-0 font-semibold">
              All notices
            </Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {news.map((item) => (
              <li key={item.id}>
                <Card as="article" className="h-full">
                  <p className="text-ink-muted">{formatDateShort(item.publishedAt)}</p>
                  <h3 className="mt-1 text-xl">
                    <Link href={`/news/${item.slug}`} className="link">
                      {item.title}
                    </Link>
                  </h3>
                  {item.summary ? <p className="mt-2 text-ink-muted">{item.summary}</p> : null}
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {events.length > 0 ? (
        <section aria-labelledby="events-heading">
          <h2 id="events-heading" className="mb-3 text-2xl">
            Coming up
          </h2>
          <ul className="grid gap-4 sm:grid-cols-3">
            {events.map((event) => (
              <li key={event.id}>
                <Card as="article" className="h-full">
                  <p className="text-ink-muted">{formatDateShort(event.startsAt)}</p>
                  <h3 className="mt-1 text-xl">
                    <Link href={`/events/${event.slug}`} className="link">
                      {event.title}
                    </Link>
                  </h3>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
