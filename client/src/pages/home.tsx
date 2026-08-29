import { Link } from "wouter";
import { FixtureList } from "@/components/data";
import { Card, CardLink, ErrorNote, Loading, Prose } from "@/components/ui";
import { useHome } from "@/lib/queries";
import { formatDateShort } from "@/lib/utils";

/**
 * Six large tappable cards for the six things people actually come here
 * for, then the two things that change week to week — the next match and
 * the last result — in full underneath.
 *
 * Deliberately not: a carousel, an auto-playing video, or a wall of links.
 * The league audit found the old home page carried twenty-odd links of
 * equal weight, which is the same as carrying none.
 */
export default function HomePage() {
  const { data, isLoading, isError } = useHome();

  if (isLoading) return <Loading what="the league's news and fixtures" />;
  if (isError || !data) return <ErrorNote what="home page" />;

  const { settings, nextFixtures, latestResults, news, events } = data;

  return (
    <div className="space-y-12">
      <section>
        <h1 className="text-4xl">{settings.clubName}</h1>
        {settings.strapline ? (
          <p className="mt-2 text-xl text-ink-muted">{settings.strapline}</p>
        ) : null}
        {settings.aboutSummary ? (
          <div className="mt-4">
            <Prose markdown={settings.aboutSummary} />
          </div>
        ) : null}
      </section>

      <section aria-labelledby="find-heading">
        <h2 id="find-heading" className="sr-only">
          Find what you came for
        </h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <CardLink
            href="/fixtures"
            title="This week's matches"
            description="Every match still to play, across all three divisions."
            meta={
              nextFixtures[0]
                ? `${formatDateShort(nextFixtures[0].playedOn)} · ${nextFixtures[0].teamName} v ${nextFixtures[0].opponentName}`
                : undefined
            }
          />
          <CardLink
            href="/results"
            title="Latest results"
            description="Every match played, with the scorecards."
            meta={
              latestResults[0]
                ? `${latestResults[0].teamName} ${latestResults[0].hrcScore ?? "?"}–${latestResults[0].opponentScore ?? "?"} ${latestResults[0].opponentName}`
                : undefined
            }
          />
          <CardLink
            href="/tables"
            title="League tables"
            description="Who is top of the Premier Division, Division One and Division Two."
          />
          <CardLink
            href="/clubs"
            title="Club details"
            description="All ten clubs — where they play, their teams and their players."
          />
          <CardLink
            href="/news"
            title="News"
            description="Notices, match reports and what's coming up."
            meta={news[0]?.title}
          />
          <CardLink
            href="/honours"
            title="Roll of honour"
            description="Champions and cup winners, back to 1950."
          />
        </div>
      </section>

      <div className="grid gap-12 lg:grid-cols-2">
        <section aria-labelledby="next-heading">
          <h2 id="next-heading" className="mb-3 text-2xl">
            Next matches
          </h2>
          <FixtureList
            fixtures={nextFixtures}
            emptyMessage="There are no matches in the calendar at the moment. Fixtures for the new season usually appear in September."
          />
          <p className="mt-3">
            <Link href="/fixtures" className="text-brand underline underline-offset-4">
              See the full fixture calendar
            </Link>
          </p>
        </section>

        <section aria-labelledby="results-heading">
          <h2 id="results-heading" className="mb-3 text-2xl">
            Latest results
          </h2>
          <FixtureList
            fixtures={latestResults}
            showResult
            emptyMessage="No results yet this season. They will appear here as soon as matches have been played."
          />
          <p className="mt-3">
            <Link href="/results" className="text-brand underline underline-offset-4">
              See every result
            </Link>
          </p>
        </section>
      </div>

      {news.length > 0 ? (
        <section aria-labelledby="news-heading">
          <h2 id="news-heading" className="mb-3 text-2xl">
            Special notices
          </h2>
          <ul className="grid gap-4 sm:grid-cols-2">
            {news.map((item) => (
              <li key={item.id}>
                <Card>
                  <h3 className="text-xl">
                    <Link href={`/news/${item.slug}`} className="text-brand underline underline-offset-4">
                      {item.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-ink-muted">{formatDateShort(item.publishedAt)}</p>
                  {item.summary ? <p className="mt-2">{item.summary}</p> : null}
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
                <Card>
                  <h3 className="text-xl">
                    <Link href={`/events/${event.slug}`} className="text-brand underline underline-offset-4">
                      {event.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-ink-muted">{formatDateShort(event.startsAt)}</p>
                </Card>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

    </div>
  );
}
