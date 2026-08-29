# hrc-club

A rebuild of **hertsttl.org.uk**, the website of the Hertford & District Table Tennis League — formed in 1936, ten clubs, 26 teams, three divisions.

Everything on it is imported from the league's own site: the clubs with their halls and squads, the committee, the forms and documents, the outward links, and the honours — 725 results going back to 1950, which the site audit calls "the single most valuable and least replaceable asset on the site".

The repository is named `hrc-club` because it began as a site for one club, HRC. The `hrc_` prefix on the Directus collections is from the same moment and has stayed: it namespaces this project on a Directus instance shared with several others, which is worth more than a tidy name.

This repository holds the site, the Directus data model as code, and the planning documents behind both.

## Running it

```bash
npm install
cp .env.example .env        # DIRECTUS_URL + DIRECTUS_SERVICE_TOKEN
npm run dev                 # API on :5000
npx vite                    # client with hot reload, proxying /api
npm test                    # 112 tests
npm run build               # client, then prerender, then server bundle
```

`npm run build` renders every route to real HTML at build time, so the site is readable with JavaScript off. If Directus is unreachable it warns and skips that step rather than failing — the built site still works, client-rendered.

## What is built

35 routes across the three tiers, following the feature set of the league site this club belongs to:

| Area | Pages |
|---|---|
| **Fixtures** | Fixture calendar grouped by league week, match history, match detail with the rubber-by-rubber card, cup news |
| **Tables** | League tables by division, averages with the eligibility rule explained, handicaps |
| **Clubs** | All ten clubs with their halls, teams and squads; every team by division; every registered player |
| **More** | Special notices, newsletters, the roll of honour and hall of fame, forms and documents, the committee, about the league, our links, how do I…?, feedback |
| **Policies** | Privacy, accessibility statement, safeguarding |

Not yet built: the league data sync (fixtures and results are entered by hand until then), the members' area, and the axe-core CI gate. See the implementation plan.

## Design

The look is warm paper, ink-first type, and one evergreen used sparingly — as a tint, a hairline or a single filled control, never as a slab.

Accessibility is built in rather than retrofitted, and it lives in the tokens rather than in a checklist: 20px base type in `rem` with an A / A+ / A++ control, AAA contrast in light and dark, 48px targets, no hover-dependent behaviour, a labelled **Menu** button on mobile, wide tables reflowing to cards below 640px, colour never the only signal, and print stylesheets.

| Path | What it is |
|---|---|
| [`client/src/index.css`](client/src/index.css) | The palette, in both themes, plus the base type and the link, focus and skeleton treatments |
| [`tailwind.config.ts`](tailwind.config.ts) | The type scale, spacing, radii and elevation built on those tokens |
| [`client/src/components/ui.tsx`](client/src/components/ui.tsx) | The whole component vocabulary — buttons, cards, badges, alerts, tables, disclosure, fields, search, filters, empty and loading states |
| [`scripts/contrast.test.ts`](scripts/contrast.test.ts) | Computes every contrast ratio from the CSS and fails the build if one drops below its requirement |

Two rules are enforced by tests rather than by care, because both have already been broken once:

- **Every contrast ratio is computed, not asserted in a comment.** A redesign is exactly the moment a colour gets nudged for looks while the comment above it still claims 7.4:1.
- **Colour is never the only signal.** The league table tints the home club's row *and* labels it; the label was dropped once during a reframe and the tint quietly became the only marker.

Palette tokens are stored as RGB channel triplets rather than hex, so Tailwind's opacity modifiers (`border-accent/30`) resolve. Written as hex they do not merely fail to apply — the class is never generated at all, and the border silently falls back to `currentColor`.

## Documents

### The club site — plan and data model

| Document | What it covers |
|---|---|
| [docs/club/00-scope-and-architecture.md](docs/club/00-scope-and-architecture.md) | What the club site is and is not, the technology stack, and how the league PRD's static/dynamic/interactive tiers are delivered in a Vite + Express stack |
| [docs/club/01-content-inventory.md](docs/club/01-content-inventory.md) | Every route, its tier, its data source, its rebuild trigger; the menu structure; the API surface; the content needed before launch |
| [docs/club/02-directus-data-model.md](docs/club/02-directus-data-model.md) | The 25 Directus collections in full, generated from the live instance, plus the permission model |
| [docs/club/03-implementation-plan.md](docs/club/03-implementation-plan.md) | Seven phases over ~11 weeks, with a leaner five-week alternative and the open questions |

### The league rebuild — inherited context

Planning documents for rebuilding **hertsttl.org.uk**, the league's own site, copied from [`kipergil/hrc-league`](https://github.com/kipergil/hrc-league). The club site inherits its architecture and its accessibility requirements from these.

| Document | What it covers |
|---|---|
| [docs/README.md](docs/README.md) | Overview of the league set and the decisions in force |
| [docs/00-site-audit.md](docs/00-site-audit.md) | Crawl of the existing league site — 90 URLs, 25 ranked findings |
| [docs/01-prd.md](docs/01-prd.md) | The league PRD: goals, the static vs dynamic analysis, the older-user design requirements, stack, risks, cost |
| [docs/02-data-model.md](docs/02-data-model.md) | The league's Directus collections, permissions, Flows, and URL map |
| [docs/03-implementation-plan.md](docs/03-implementation-plan.md) | Six phases over ~18 weeks |
| [docs/04-open-questions.md](docs/04-open-questions.md) | 23 decisions — four settled, nineteen open |

## Directus schema

The club's collections live on a Directus instance shared with several other projects. Everything here is prefixed `hrc_` and filed under the `hrc_club` folder, and the tooling refuses to run if a definition strays outside that prefix.

```bash
cd directus
cp .env.example .env      # fill in ADMIN_EMAIL / ADMIN_PASSWORD
npm install
npm run schema:apply      # idempotent; creates what is missing, changes nothing else
npm run permissions:apply # creates the service role and prints its token once
npm run seed              # placeholder editorial content (pages, FAQs, links)
npm run import:league     # all ten clubs, their venues, teams and squads
npm run import:content    # the league's description, committee, documents, links and honours
```

**The seeded content is placeholder, and the site knows it.** It exists so the layouts and the empty states can be judged against something realistic. Every seeded body begins with the word `PLACEHOLDER`, and `server/storage.ts` refuses to serve any text that does — an article or event whose body is placeholder is dropped from the API entirely, and a page's body comes back null so the reader is told it has not been written yet.

That mark is therefore load-bearing, not a note to self: keep it at the start of anything not meant for the public, and remove it in the Directus admin panel when the real words go in.

| Path | What it is |
|---|---|
| [`directus/src/schema/definitions.ts`](directus/src/schema/definitions.ts) | The 25 collections — the source of truth for the data model |
| [`directus/src/schema/apply.ts`](directus/src/schema/apply.ts) | Applies them, idempotently, with the prefix guard |
| [`directus/src/permissions/definitions.ts`](directus/src/permissions/definitions.ts) | The `HRC Club Service` policy — what the server's token may read and write |
| [`directus/src/content/seed.ts`](directus/src/content/seed.ts) | Placeholder starter content, idempotent |
| [`shared/enums.ts`](shared/enums.ts) | Every closed value set, shared by the schema tooling, the server and the client |

## Stack

React 18 · Vite · wouter · TanStack Query · Tailwind · Radix · Express · Directus 11 · Vercel — following [`kipergil/pintogather`](https://github.com/kipergil/pintogather). This diverges from the league PRD, which specifies Nuxt; the reasoning is in [docs/club/00-scope-and-architecture.md](docs/club/00-scope-and-architecture.md) §3.

| Path | What it is |
|---|---|
| `client/` | The React app — pages, the eleven-component vocabulary, the design tokens |
| `server/` | Express BFF: `storage.ts` maps Directus rows to read models, `routes.ts` serves them with the cache policy for their tier |
| `api/index.ts` | The same app as a Vercel function |
| `scripts/prerender.tsx` | Renders every route to HTML at build time, with its data embedded |
| `shared/` | Enums, read-model types, the enquiry schema, the API client — used by client, server and prerenderer alike |
