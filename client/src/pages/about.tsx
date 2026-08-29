import { Download, ExternalLink, Mail, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "wouter";
import { DOCUMENT_CATEGORY_LABELS } from "@shared/enums.js";
import type { Honour } from "@shared/types.js";
import { PageHeader, PrintButton } from "@/components/layout";
import {
  Badge,
  Card,
  Disclosure,
  Empty,
  ErrorNote,
  FilterChips,
  Loading,
  Prose,
  SearchBox,
  Stat,
  TableNote,
  TableScroller,
  Td,
  Th,
  Tr,
} from "@/components/ui";
import { useCommittee, useDocuments, useFaqs, useHonours, useLinks } from "@/lib/queries";
import { fileUrl, formatDateNumeric } from "@/lib/utils";

export function CommitteePage() {
  const { data: roles, isLoading, isError } = useCommittee();

  if (isLoading) return <Loading what="the committee" variant="cards" />;
  if (isError) return <ErrorNote what="committee list" />;

  return (
    <div>
      <PageHeader title="Who's who" subtitle="The committee, and who to ask about what" />

      {!roles || roles.length === 0 ? (
        <Empty>The committee list has not been published yet.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {roles.map((role) => {
            /*
             * A post is vacant only when nobody is in it. The old page
             * treated a null `member` as a vacancy, but the league's
             * committee are not all registered players, so a name that
             * arrived as plain text made the card announce the holder and
             * then declare the post empty in the same breath.
             */
            const holder = role.member?.displayName ?? role.member?.fullName ?? role.holderName;

            return (
              <li key={role.id}>
                <Card className="flex h-full flex-col">
                  <h2 className="font-semibold uppercase tracking-wide text-ink-muted">
                    {role.roleTitle}
                  </h2>

                  {holder ? (
                    <p className="mt-1 text-xl font-semibold text-ink">
                      {role.member ? (
                        <Link href={`/players/${role.member.slug}`} className="link">
                          {holder}
                        </Link>
                      ) : (
                        holder
                      )}
                    </p>
                  ) : (
                    <p className="mt-1 text-xl text-ink-muted">
                      Vacant
                      <span className="mt-1 block text-base">Could this be you?</span>
                    </p>
                  )}

                  {role.responsibilities ? (
                    <div className="mt-2">
                      <Prose markdown={role.responsibilities} />
                    </div>
                  ) : null}

                  {/*
                    A role address, not a personal one. When the post changes
                    hands the page needs no edit, and nobody's own address is
                    published to be scraped.
                  */}
                  {role.publicEmail ? (
                    <p className="mt-auto pt-3">
                      <a href={`mailto:${role.publicEmail}`} className="link inline-flex items-center gap-2">
                        <Mail aria-hidden="true" className="size-5 shrink-0" />
                        {role.publicEmail}
                      </a>
                    </p>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-8 max-w-readable text-ink-muted">
        The league does not publish personal addresses. To reach the committee,{" "}
        <Link href="/contact" className="link font-semibold">
          send a message through the site
        </Link>{" "}
        and it will go to the right person.
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------

/** Does this honour match what the reader typed? */
function matchesHonour(honour: Honour, query: string): boolean {
  const haystack = [
    honour.competitionName ?? honour.title,
    honour.recipientName,
    honour.seasonLabel,
    honour.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(query);
}

export function HonoursPage() {
  const { data: honours, isLoading, isError } = useHonours();
  const [query, setQuery] = useState("");

  const all = useMemo(() => honours ?? [], [honours]);

  /*
   * Two different records, and they want showing differently.
   *
   * The recent Rolls of Honour carry a runner-up and a season written the
   * way a season is written ("2025-26"), so they read best as a season at a
   * time. The Hall of Fame is hundreds of results over seventy-five years,
   * labelled by a single year, and reading it a year at a time would mean
   * seventy-five headings — so it goes by competition, which is how anyone
   * actually asks ("who has won the Creasey Cup?").
   */
  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return needle ? all.filter((honour) => matchesHonour(honour, needle)) : all;
  }, [all, query]);

  const seasons = filtered.filter((honour) => honour.seasonLabel.includes("-"));
  const historic = filtered.filter((honour) => !honour.seasonLabel.includes("-"));
  const seasonLabels = [...new Set(seasons.map((h) => h.seasonLabel))].sort().reverse();
  const competitions = [...new Set(historic.map((h) => h.competitionName ?? h.title))];

  const earliest = useMemo(() => {
    const years = all
      .map((honour) => Number(honour.seasonLabel.slice(0, 4)))
      .filter((year) => Number.isFinite(year) && year > 1900);
    return years.length > 0 ? Math.min(...years) : null;
  }, [all]);

  if (isLoading) return <Loading what="the roll of honour" variant="table" />;
  if (isError) return <ErrorNote what="roll of honour" />;

  if (all.length === 0) {
    return (
      <>
        <PageHeader title="Roll of honour" subtitle="Champions and cup winners, back to 1950" />
        <Empty>The roll of honour has not been imported yet.</Empty>
      </>
    );
  }

  const searching = query.trim().length > 0;

  return (
    <div className="space-y-10">
      <PageHeader
        title="Roll of honour"
        subtitle={`Every champion and cup winner the league has a record of${earliest ? `, back to ${earliest}` : ""}.`}
        actions={<PrintButton label="Print the roll of honour" />}
      >
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat value={all.length} label="results recorded" />
          <Stat value={[...new Set(all.map((h) => h.competitionName ?? h.title))].length} label="competitions" />
          <Stat value={[...new Set(all.map((h) => h.seasonLabel))].length} label="seasons" />
          {earliest ? <Stat value={earliest} label="earliest record" /> : null}
        </dl>
      </PageHeader>

      {/*
        This page is the largest on the site — several hundred rows, and
        every one of them rendered at once. Without a search box the only
        way to answer "has my club ever won anything?" was the browser's
        own find-in-page over a document that takes a moment to settle.
      */}
      <SearchBox
        label="Search the roll of honour"
        placeholder="A club, a player, a competition or a year"
        value={query}
        onChange={setQuery}
        resultCount={{ shown: filtered.length, total: all.length, noun: "results" }}
      />

      {filtered.length === 0 ? (
        <Empty>
          Nothing in the roll of honour matches “{query}”. Try a surname on its own, or a club name
          without its “TTC”.
        </Empty>
      ) : null}

      {seasonLabels.length > 0 ? (
        <section aria-labelledby="recent-heading">
          <h2 id="recent-heading" className="text-2xl">
            Recent seasons
          </h2>
          <TableNote>
            The full result of every competition, season by season, with the runners-up.
          </TableNote>
          <div className="space-y-8">
            {seasonLabels.map((season) => (
              <div key={season}>
                <h3 className="mb-2 text-xl">{season}</h3>
                <TableScroller>
                  <thead>
                    <tr>
                      <Th>Competition</Th>
                      <Th>Winner</Th>
                      <Th>Runner-up</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {seasons
                      .filter((honour) => honour.seasonLabel === season)
                      .map((honour) => (
                        <Tr key={honour.id}>
                          <Td>{honour.competitionName ?? honour.title}</Td>
                          <Td className="font-semibold">
                            <span className="inline-flex items-center gap-2">
                              <Trophy aria-hidden="true" className="size-5 shrink-0 text-accent" />
                              {honour.recipientName ?? "—"}
                            </span>
                          </Td>
                          <Td className="text-ink-muted">
                            {honour.notes?.replace(/^Runner-up:\s*/i, "") ?? "—"}
                          </Td>
                        </Tr>
                      ))}
                  </tbody>
                </TableScroller>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      {competitions.length > 0 ? (
        <section aria-labelledby="hall-heading">
          <h2 id="hall-heading" className="text-2xl">
            Hall of fame
          </h2>
          <TableNote>
            Every winner the league has a record of, by competition. Years the competition was not
            played are left out rather than listed as blank.
          </TableNote>
          <ul className="space-y-3">
            {competitions.map((competition) => {
              const winners = historic
                .filter((honour) => (honour.competitionName ?? honour.title) === competition)
                .sort((a, b) => Number(b.seasonLabel) - Number(a.seasonLabel));
              return (
                <li key={competition}>
                  <Disclosure
                    summary={competition}
                    meta={`${winners.length} ${winners.length === 1 ? "winner" : "winners"}`}
                    // A search that matches only a handful opens what it
                    // found, rather than leaving the reader to open each
                    // one to discover which contains their result.
                    defaultOpen={searching && competitions.length <= 4}
                  >
                    <ul className="columns-1 gap-8 sm:columns-2 lg:columns-3">
                      {winners.map((honour) => (
                        <li key={honour.id} className="break-inside-avoid py-0.5 tabular">
                          <span className="font-semibold text-ink">{honour.seasonLabel}</span>
                          <span className="text-ink-muted"> · </span>
                          <span>{honour.recipientName}</span>
                        </li>
                      ))}
                    </ul>
                  </Disclosure>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DocumentsPage() {
  const { data: documents, isLoading, isError } = useDocuments();

  if (isLoading) return <Loading what="league documents" variant="list" />;
  if (isError) return <ErrorNote what="documents" />;

  const categories = [...new Set((documents ?? []).map((doc) => doc.category))];

  return (
    <div>
      <PageHeader
        title="Forms and documents"
        subtitle="The handbook, the constitution, scorecards and the forms clubs need"
      />

      {categories.length === 0 ? (
        <Empty>No documents have been published yet.</Empty>
      ) : (
        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-3 text-2xl">{DOCUMENT_CATEGORY_LABELS[category] ?? category}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {(documents ?? [])
                  .filter((doc) => doc.category === category)
                  .map((doc) => {
                    const href = doc.fileId ? fileUrl(doc.fileId)! : doc.externalUrl;
                    return (
                      <li key={doc.id}>
                        <Card className="flex h-full gap-4">
                          <span
                            aria-hidden="true"
                            className="mt-0.5 inline-flex size-11 shrink-0 items-center justify-center rounded-card bg-brand-soft text-brand"
                          >
                            <Download className="size-5" />
                          </span>
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold">
                              {href ? (
                                <a href={href} className="link">
                                  {doc.title}
                                </a>
                              ) : (
                                doc.title
                              )}
                            </h3>
                            {doc.documentDate ? (
                              <p className="mt-0.5 text-ink-muted">
                                {formatDateNumeric(doc.documentDate)}
                              </p>
                            ) : null}
                            {/*
                              A one-line description so nobody has to
                              download a PDF to find out what it is.
                            */}
                            {doc.description ? (
                              <div className="mt-1">
                                <Prose markdown={doc.description} />
                              </div>
                            ) : null}
                            {/*
                              Says where the file actually lives. A
                              document still hosted on the old site is one
                              that disappears when it is switched off, and
                              that is worth knowing before it happens.
                            */}
                            {!doc.fileId && doc.externalUrl ? (
                              <p className="mt-2">
                                <Badge tone="neutral">On the old league site</Badge>
                              </p>
                            ) : null}
                          </div>
                        </Card>
                      </li>
                    );
                  })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function LinksPage() {
  const { data: links, isLoading, isError } = useLinks();

  if (isLoading) return <Loading what="links" variant="list" />;
  if (isError) return <ErrorNote what="links" />;

  const categories = [...new Set((links ?? []).map((link) => link.category ?? "Other"))];

  return (
    <div>
      <PageHeader
        title="Our links"
        subtitle="Table Tennis England, the county association, coaching and suppliers"
      />

      {categories.length === 0 ? (
        <Empty>No links have been added yet.</Empty>
      ) : (
        <div className="space-y-10">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-3 text-2xl">{category}</h2>
              <ul className="grid gap-3 sm:grid-cols-2">
                {(links ?? [])
                  .filter((link) => (link.category ?? "Other") === category)
                  .map((link) => (
                    <li key={link.id}>
                      <a
                        href={link.url}
                        className="group flex h-full items-start gap-3 rounded-card border border-line bg-surface p-4 no-underline shadow-card transition-[border-color,box-shadow] hover:border-brand hover:shadow-lifted"
                      >
                        <ExternalLink
                          aria-hidden="true"
                          className="mt-1 size-5 shrink-0 text-ink-muted transition-colors group-hover:text-brand"
                        />
                        <span className="min-w-0">
                          <span className="block font-semibold text-brand underline decoration-brand/40 underline-offset-4 group-hover:decoration-brand">
                            {link.label}
                          </span>
                          {link.description ? (
                            <span className="mt-0.5 block text-ink-muted">{link.description}</span>
                          ) : null}
                          {/* The destination, in words, before they go. */}
                          <span className="mt-1 block break-all text-ink-muted">
                            {link.url.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")}
                          </span>
                        </span>
                      </a>
                    </li>
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function HelpPage() {
  const { data: faqs, isLoading, isError } = useFaqs();
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return faqs ?? [];
    return (faqs ?? []).filter((faq) =>
      `${faq.question} ${faq.answer ?? ""}`.toLowerCase().includes(needle),
    );
  }, [faqs, query]);

  if (isLoading) return <Loading what="the help page" variant="list" />;
  if (isError) return <ErrorNote what="help page" />;

  const categories = [...new Set(filtered.map((faq) => faq.category ?? "General"))];

  return (
    <div>
      <PageHeader title="How do I…?" subtitle="Answers to the questions we're asked most" />

      {!faqs || faqs.length === 0 ? (
        <Empty>
          We haven’t written these up yet. In the meantime, ask us anything — we’d rather answer the
          question than have you wondering.
        </Empty>
      ) : (
        <>
          <SearchBox
            label="Search the answers"
            placeholder="What do you need to know?"
            value={query}
            onChange={setQuery}
            resultCount={{ shown: filtered.length, total: faqs.length, noun: "answers" }}
            className="mb-8"
          />

          {filtered.length === 0 ? (
            <Empty
              action={
                <Link href="/contact" className="link font-semibold">
                  Ask us instead
                </Link>
              }
            >
              Nothing here matches “{query}”.
            </Empty>
          ) : (
            <div className="space-y-8">
              {categories.map((category) => (
                <section key={category}>
                  {categories.length > 1 ? (
                    <h2 className="mb-3 text-2xl">{category}</h2>
                  ) : null}
                  <ul className="max-w-readable space-y-3">
                    {filtered
                      .filter((faq) => (faq.category ?? "General") === category)
                      .map((faq) => (
                        <li key={faq.id}>
                          <Disclosure summary={faq.question}>
                            <Prose markdown={faq.answer} />
                          </Disclosure>
                        </li>
                      ))}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </>
      )}

      <p className="mt-10 max-w-readable">
        Still stuck?{" "}
        <Link href="/contact" className="link font-semibold">
          Send us a message
        </Link>{" "}
        and a real person will reply.
      </p>
    </div>
  );
}
