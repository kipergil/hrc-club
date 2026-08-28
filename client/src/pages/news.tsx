import { Link } from "wouter";
import { PageHeader } from "@/components/layout";
import { Badge, Card, Empty, ErrorNote, Loading, Prose } from "@/components/ui";
import { useAlbum, useEvent, useEvents, useGallery, useNews, useNewsItem } from "@/lib/queries";
import { fileUrl, formatDateLong, formatDateShort } from "@/lib/utils";

const CATEGORY_LABEL: Record<string, string> = {
  news: "News",
  match_report: "Match report",
  notice: "Notice",
  newsletter: "Newsletter",
};

function NewsCard({
  item,
}: {
  item: {
    id: string;
    title: string;
    slug: string;
    summary: string | null;
    category: string;
    isPinned: boolean;
    publishedAt: string | null;
    heroImageId: string | null;
  };
}) {
  const image = fileUrl(item.heroImageId, { width: 640, height: 360, fit: "cover" });
  return (
    <Card className="h-full">
      {image ? (
        <img
          src={image}
          alt=""
          width={320}
          height={180}
          className="mb-3 aspect-video w-full rounded-card object-cover"
        />
      ) : null}
      <h2 className="text-xl">
        <Link href={`/news/${item.slug}`} className="text-brand underline underline-offset-4">
          {item.title}
        </Link>
      </h2>
      <p className="mt-1 flex flex-wrap items-center gap-2 text-ink-muted">
        <span>{formatDateShort(item.publishedAt)}</span>
        <Badge>{CATEGORY_LABEL[item.category] ?? item.category}</Badge>
        {item.isPinned ? <Badge tone="accent">Pinned</Badge> : null}
      </p>
      {item.summary ? <p className="mt-2">{item.summary}</p> : null}
    </Card>
  );
}

export function NewsPage() {
  const { data: items, isLoading, isError } = useNews();

  if (isLoading) return <Loading what="the news" />;
  if (isError) return <ErrorNote what="news" />;

  // Newsletters have their own page, so they are kept out of the news list
  // rather than burying two lines of news under a run of PDFs.
  const posts = (items ?? []).filter((item) => item.category !== "newsletter");

  return (
    <div>
      <PageHeader title="News and notices" subtitle="What's happening at the club" />

      {posts.length === 0 ? (
        <Empty>Nothing has been posted yet. Club news will appear here.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {posts.map((item) => (
            <li key={item.id}>
              <NewsCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewslettersPage() {
  const { data: items, isLoading, isError } = useNews("newsletter");

  if (isLoading) return <Loading what="newsletters" />;
  if (isError) return <ErrorNote what="newsletters" />;

  return (
    <div>
      <PageHeader title="Newsletters" subtitle="Every newsletter we've sent" />

      {!items || items.length === 0 ? (
        <Empty>No newsletters have been published yet.</Empty>
      ) : (
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id}>
              <Card>
                <h2 className="text-xl">
                  <Link href={`/news/${item.slug}`} className="text-brand underline underline-offset-4">
                    {item.title}
                  </Link>
                </h2>
                <p className="mt-1 text-ink-muted">{formatDateLong(item.publishedAt)}</p>
                {item.summary ? <p className="mt-2">{item.summary}</p> : null}
                {item.attachmentId ? (
                  <p className="mt-3">
                    <a
                      href={fileUrl(item.attachmentId)!}
                      className="text-brand underline underline-offset-4"
                    >
                      Download the newsletter
                    </a>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewsItemPage({ slug }: { slug: string }) {
  const { data: item, isLoading, isError } = useNewsItem(slug);

  if (isLoading) return <Loading what="this article" />;
  if (isError || !item) return <ErrorNote what="article" />;

  const image = fileUrl(item.heroImageId, { width: 1200 });

  return (
    <article>
      <PageHeader
        title={item.title}
        subtitle={`${CATEGORY_LABEL[item.category] ?? item.category} · ${formatDateLong(item.publishedAt)}${
          item.authorName ? ` · by ${item.authorName}` : ""
        }`}
      />

      {image ? (
        <img
          src={image}
          alt=""
          className="mb-6 w-full rounded-card object-cover"
          width={1200}
          height={600}
        />
      ) : null}

      {item.summary ? <p className="mb-6 max-w-prose text-lg text-ink-muted">{item.summary}</p> : null}

      <Prose markdown={item.body} />

      {item.attachmentId ? (
        <p className="mt-6">
          <a href={fileUrl(item.attachmentId)!} className="text-brand underline underline-offset-4">
            Download the attachment
          </a>
        </p>
      ) : null}

      {item.fixtureId ? (
        <p className="mt-6">
          <Link href={`/results/${item.fixtureId}`} className="text-brand underline underline-offset-4">
            See the scorecard for this match
          </Link>
        </p>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------

export function EventsPage() {
  const { data: events, isLoading, isError } = useEvents();

  if (isLoading) return <Loading what="events" />;
  if (isError) return <ErrorNote what="events" />;

  return (
    <div>
      <PageHeader title="What's on" subtitle="AGM, presentation night and socials" />

      {!events || events.length === 0 ? (
        <Empty>Nothing is in the diary at the moment. Club events will appear here.</Empty>
      ) : (
        <ul className="space-y-3">
          {events.map((event) => (
            <li key={event.id}>
              <Card>
                <h2 className="text-xl">
                  <Link href={`/events/${event.slug}`} className="text-brand underline underline-offset-4">
                    {event.title}
                  </Link>
                </h2>
                <p className="mt-1 text-ink-muted">
                  {formatDateLong(event.startsAt)}
                  {event.venueName ? ` · ${event.venueName}` : null}
                </p>
                {event.isMembersOnly ? (
                  <p className="mt-2">
                    <Badge>Members only</Badge>
                  </p>
                ) : null}
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function EventPage({ slug }: { slug: string }) {
  const { data: event, isLoading, isError } = useEvent(slug);

  if (isLoading) return <Loading what="this event" />;
  if (isError || !event) return <ErrorNote what="event" />;

  return (
    <article className="space-y-6">
      <PageHeader
        title={event.title}
        subtitle={`${formatDateLong(event.startsAt)}${event.venueName ? ` · ${event.venueName}` : ""}`}
      />

      {event.status === "cancelled" ? (
        <p>
          <Badge tone="negative">This event has been cancelled</Badge>
        </p>
      ) : null}

      <Prose markdown={event.description} />

      {event.costNote ? (
        <p>
          <span className="font-semibold">Cost: </span>
          {event.costNote}
        </p>
      ) : null}

      {event.entryUrl ? (
        <p>
          <a href={event.entryUrl} className="text-brand underline underline-offset-4">
            Enter or book a place
          </a>
        </p>
      ) : null}
    </article>
  );
}

// ---------------------------------------------------------------------------

export function GalleryPage() {
  const { data: albums, isLoading, isError } = useGallery();

  if (isLoading) return <Loading what="the photo albums" />;
  if (isError) return <ErrorNote what="photos" />;

  return (
    <div>
      <PageHeader title="Photos" subtitle="Match nights, finals and presentation evenings" />

      {!albums || albums.length === 0 ? (
        <Empty>No photo albums have been published yet.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {albums.map((album) => {
            const cover = fileUrl(album.coverImageId, { width: 640, height: 480, fit: "cover" });
            return (
              <li key={album.id}>
                <Card className="h-full">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      width={320}
                      height={240}
                      className="mb-3 aspect-[4/3] w-full rounded-card object-cover"
                    />
                  ) : null}
                  <h2 className="text-xl">
                    <Link
                      href={`/gallery/${album.slug}`}
                      className="text-brand underline underline-offset-4"
                    >
                      {album.title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-ink-muted">
                    {album.takenOn ? `${formatDateShort(album.takenOn)} · ` : null}
                    {album.itemCount} {album.itemCount === 1 ? "photo" : "photos"}
                  </p>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AlbumPage({ slug }: { slug: string }) {
  const { data: album, isLoading, isError } = useAlbum(slug);

  if (isLoading) return <Loading what="this album" />;
  if (isError || !album) return <ErrorNote what="album" />;

  return (
    <div>
      <PageHeader
        title={album.title}
        subtitle={album.takenOn ? formatDateLong(album.takenOn) : "Club photos"}
      />

      {album.description ? (
        <div className="mb-6">
          <Prose markdown={album.description} />
        </div>
      ) : null}

      {album.items.length === 0 ? (
        <Empty>There are no photos in this album yet.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {album.items.map((item) => {
            const image = fileUrl(item.imageId, { width: 800 });
            return (
              <li key={item.id}>
                <figure>
                  {image ? (
                    /*
                      The caption is the alt text. It is a required field in
                      Directus for exactly this reason — a photo with no
                      description is a photo half the club cannot see.
                    */
                    <img
                      src={image}
                      alt={item.caption}
                      width={400}
                      height={300}
                      className="w-full rounded-card object-cover"
                    />
                  ) : null}
                  <figcaption className="mt-2 text-ink-muted">{item.caption}</figcaption>
                </figure>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
