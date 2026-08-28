# hrc-club

Website for **HRC**, one of the ten clubs in the Hertford & District Table Tennis League, fielding three teams — HRC A, HRC B and HRC C.

This repository holds the planning documents, the Directus data model as code, and (from Phase 0 onwards) the site itself.

## Documents

### The club site — plan and data model

| Document | What it covers |
|---|---|
| [docs/club/00-scope-and-architecture.md](docs/club/00-scope-and-architecture.md) | What the club site is and is not, the technology stack, and how the league PRD's static/dynamic/interactive tiers are delivered in a Vite + Express stack |
| [docs/club/01-content-inventory.md](docs/club/01-content-inventory.md) | Every route, its tier, its data source, its rebuild trigger; the menu structure; the API surface; the content needed before launch |
| [docs/club/02-directus-data-model.md](docs/club/02-directus-data-model.md) | The 24 Directus collections in full, generated from the live instance, plus the permission model |
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
```

| Path | What it is |
|---|---|
| [`directus/src/schema/definitions.ts`](directus/src/schema/definitions.ts) | The 24 collections — the source of truth for the data model |
| [`directus/src/schema/apply.ts`](directus/src/schema/apply.ts) | Applies them, idempotently, with the prefix guard |
| [`directus/src/permissions/definitions.ts`](directus/src/permissions/definitions.ts) | The `HRC Club Service` policy — what the server's token may read and write |
| [`shared/enums.ts`](shared/enums.ts) | Every closed value set, shared by the schema tooling and (later) the app |

## Stack

React 18 · Vite · wouter · TanStack Query · Tailwind + shadcn/ui · Express · Directus 11 · Clerk · Vercel — following [`kipergil/pintogather`](https://github.com/kipergil/pintogather). This diverges from the league PRD, which specifies Nuxt; the reasoning is in [docs/club/00-scope-and-architecture.md](docs/club/00-scope-and-architecture.md) §3.
