import { Link } from "wouter";
import { COMPETITION_LABELS, DOCUMENT_CATEGORY_LABELS } from "@shared/enums.js";
import { PageHeader } from "@/components/layout";
import {
  Badge,
  Card,
  Disclosure,
  Empty,
  ErrorNote,
  Loading,
  Prose,
  TableNote,
  TableScroller,
  Td,
  Th,
} from "@/components/ui";
import { useCommittee, useDocuments, useFaqs, useHonours, useLinks, useSponsors } from "@/lib/queries";
import { fileUrl, formatDateNumeric } from "@/lib/utils";

export function CommitteePage() {
  const { data: roles, isLoading, isError } = useCommittee();

  if (isLoading) return <Loading what="the committee" />;
  if (isError) return <ErrorNote what="committee list" />;

  return (
    <div>
      <PageHeader title="Who's who" subtitle="The committee, and who to ask about what" />

      {!roles || roles.length === 0 ? (
        <Empty>The committee list has not been published yet.</Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {roles.map((role) => (
            <li key={role.id}>
              <Card className="h-full">
                <h2 className="text-xl">{role.roleTitle}</h2>
                {role.member ? (
                  <p className="mt-1 text-lg">
                    <Link
                      href={`/players/${role.member.slug}`}
                      className="text-brand underline underline-offset-4"
                    >
                      {role.member.displayName ?? role.member.fullName}
                    </Link>
                  </p>
                ) : (
                  <p className="mt-1 text-ink-muted">Vacant — could this be you?</p>
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
                  <p className="mt-3">
                    <a
                      href={`mailto:${role.publicEmail}`}
                      className="text-brand underline underline-offset-4"
                    >
                      {role.publicEmail}
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

// ---------------------------------------------------------------------------

export function HonoursPage() {
  const { data: honours, isLoading, isError } = useHonours();

  if (isLoading) return <Loading what="the roll of honour" />;
  if (isError) return <ErrorNote what="roll of honour" />;

  const seasons = [...new Set((honours ?? []).map((honour) => honour.seasonLabel))];

  return (
    <div>
      <PageHeader title="Roll of honour" subtitle="Every title and trophy we've won" />

      {seasons.length === 0 ? (
        <Empty>
          The roll of honour has not been filled in yet. If you have club records — programmes,
          photographs, a trophy with names on it — we would very much like to hear from you.
        </Empty>
      ) : (
        <>
          <TableNote>
            Listed newest first. Team honours are the club’s; individual honours belong to the
            player named.
          </TableNote>

          <div className="space-y-8">
            {seasons.map((season) => (
              <section key={season}>
                <h2 className="mb-3 text-2xl">{season}</h2>
                <TableScroller>
                  <thead>
                    <tr>
                      <Th>Honour</Th>
                      <Th>Competition</Th>
                      <Th>Who</Th>
                    </tr>
                  </thead>
                  <tbody>
                    {(honours ?? [])
                      .filter((honour) => honour.seasonLabel === season)
                      .map((honour) => (
                        <tr key={honour.id}>
                          <Td className="font-semibold">
                            {honour.title}
                            {honour.notes ? (
                              <span className="block font-normal text-ink-muted">{honour.notes}</span>
                            ) : null}
                          </Td>
                          <Td>
                            {honour.competition
                              ? (COMPETITION_LABELS[honour.competition] ?? honour.competition)
                              : "—"}
                          </Td>
                          <Td>
                            {honour.memberSlug ? (
                              <Link
                                href={`/players/${honour.memberSlug}`}
                                className="text-brand underline"
                              >
                                {honour.recipientName}
                              </Link>
                            ) : (
                              (honour.recipientName ?? honour.teamName ?? "The club")
                            )}
                          </Td>
                        </tr>
                      ))}
                  </tbody>
                </TableScroller>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function DocumentsPage() {
  const { data: documents, isLoading, isError } = useDocuments();

  if (isLoading) return <Loading what="club documents" />;
  if (isError) return <ErrorNote what="documents" />;

  const categories = [...new Set((documents ?? []).map((doc) => doc.category))];

  return (
    <div>
      <PageHeader title="Club documents" subtitle="Constitution, minutes and forms" />

      {categories.length === 0 ? (
        <Empty>No documents have been published yet.</Empty>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-3 text-2xl">
                {DOCUMENT_CATEGORY_LABELS[category] ?? category}
              </h2>
              <ul className="space-y-3">
                {(documents ?? [])
                  .filter((doc) => doc.category === category)
                  .map((doc) => (
                    <li key={doc.id}>
                      <Card>
                        <h3 className="text-xl">{doc.title}</h3>
                        {doc.documentDate ? (
                          <p className="mt-1 text-ink-muted">{formatDateNumeric(doc.documentDate)}</p>
                        ) : null}
                        {/*
                          A one-line description so nobody has to download a
                          PDF to find out what it is.
                        */}
                        {doc.description ? (
                          <div className="mt-2">
                            <Prose markdown={doc.description} />
                          </div>
                        ) : null}
                        {doc.fileId ? (
                          <p className="mt-3">
                            <a
                              href={fileUrl(doc.fileId)!}
                              className="text-brand underline underline-offset-4"
                            >
                              Download “{doc.title}”
                            </a>
                          </p>
                        ) : null}
                      </Card>
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

export function LinksPage() {
  const { data: links, isLoading, isError } = useLinks();

  if (isLoading) return <Loading what="links" />;
  if (isError) return <ErrorNote what="links" />;

  const categories = [...new Set((links ?? []).map((link) => link.category ?? "Other"))];

  return (
    <div>
      <PageHeader title="Useful links" subtitle="The league, the county and beyond" />

      {categories.length === 0 ? (
        <Empty>No links have been added yet.</Empty>
      ) : (
        <div className="space-y-8">
          {categories.map((category) => (
            <section key={category}>
              <h2 className="mb-3 text-2xl">{category}</h2>
              <ul className="space-y-3">
                {(links ?? [])
                  .filter((link) => (link.category ?? "Other") === category)
                  .map((link) => (
                    <li key={link.id}>
                      <a href={link.url} className="text-lg text-brand underline underline-offset-4">
                        {link.label}
                      </a>
                      {link.description ? (
                        <p className="text-ink-muted">{link.description}</p>
                      ) : null}
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

export function SponsorsPage() {
  const { data: sponsors, isLoading, isError } = useSponsors();

  if (isLoading) return <Loading what="our sponsors" />;
  if (isError) return <ErrorNote what="sponsors" />;

  return (
    <div>
      <PageHeader title="Sponsors" subtitle="The people who help us keep going" />

      {!sponsors || sponsors.length === 0 ? (
        <Empty>
          We have no sponsors listed at the moment. If your business would like to support local
          table tennis, we’d be glad to hear from you.
        </Empty>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {sponsors.map((sponsor) => {
            const logo = fileUrl(sponsor.logoId, { width: 400 });
            return (
              <li key={sponsor.id}>
                <Card className="h-full">
                  {logo ? (
                    <img
                      src={logo}
                      alt={`${sponsor.name} logo`}
                      width={200}
                      height={100}
                      className="mb-3 h-24 w-auto object-contain"
                    />
                  ) : null}
                  <h2 className="text-xl">
                    {sponsor.url ? (
                      <a href={sponsor.url} className="text-brand underline underline-offset-4">
                        {sponsor.name}
                      </a>
                    ) : (
                      sponsor.name
                    )}
                  </h2>
                  <p className="mt-1">
                    <Badge tone={sponsor.tier === "principal" ? "accent" : "neutral"}>
                      {sponsor.tier === "principal"
                        ? "Principal sponsor"
                        : sponsor.tier === "supporting"
                          ? "Supporting sponsor"
                          : "Friend of the club"}
                    </Badge>
                  </p>
                  {sponsor.description ? (
                    <div className="mt-2">
                      <Prose markdown={sponsor.description} />
                    </div>
                  ) : null}
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------

export function HelpPage() {
  const { data: faqs, isLoading, isError } = useFaqs();

  if (isLoading) return <Loading what="the help page" />;
  if (isError) return <ErrorNote what="help page" />;

  return (
    <div>
      <PageHeader title="How do I…?" subtitle="Answers to the questions we're asked most" />

      {!faqs || faqs.length === 0 ? (
        <Empty>
          We haven’t written these up yet. In the meantime, ask us anything — we’d rather answer the
          question than have you wondering.
        </Empty>
      ) : (
        <ul className="max-w-prose space-y-3">
          {faqs.map((faq) => (
            <li key={faq.id}>
              <Disclosure summary={faq.question}>
                <Prose markdown={faq.answer} />
              </Disclosure>
            </li>
          ))}
        </ul>
      )}

      <p className="mt-8 max-w-prose">
        Still stuck?{" "}
        <Link href="/contact" className="text-brand underline underline-offset-4">
          Send us a message
        </Link>{" "}
        and a real person will reply.
      </p>
    </div>
  );
}
