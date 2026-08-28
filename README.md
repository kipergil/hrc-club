# hrc-club

Website for **HRC**, one of the ten clubs in the Hertford & District Table Tennis League, fielding four teams — HRC A and B in the Premier Division, HRC C in Division One and HRC D in Division Two. The club plays at Bushby Hall, Wormley.

The site carries the **whole league**: all ten clubs with their venues, teams and squads — 26 teams and 165 squad places, imported from the league's own pages. `is_home_club` marks HRC, and that is what "our teams" and "our players" filter on.

This repository holds the site, the Directus data model as code, and the planning documents behind both.

## Running it

```bash
npm install
cp .env.example .env        # DIRECTUS_URL + DIRECTUS_SERVICE_TOKEN
npm run dev                 # API on :5000
npx vite                    # client with hot reload, proxying /api
npm test                    # 32 tests
npm run build               # client, then prerender, then server bundle
```

`npm run build` renders every route to real HTML at build time, so the site is readable with JavaScript off. If Directus is unreachable it warns and skips that step rather than failing — the built site still works, client-rendered.

## What is built

36 routes across the three tiers, following the feature set of the league site this club belongs to:

| Area | Pages |
|---|---|
| **Play** | When we play (the timetable — the most important page on the site), venue detail with directions, parking and access, join us with fees, coaching, juniors |
| **Teams** | All ten clubs with their venues and squads, our teams, team detail with squad and match history, fixture calendar grouped by league week, results, match detail with the rubber-by-rubber card, league tables, averages, handicaps, cup matches, players and player profiles |
| **News** | News and notices, articles, newsletters, events, photo albums |
| **About** | About, history, who's who, roll of honour, documents, links, sponsors, how do I…?, contact form |
| **Policies** | Privacy, accessibility statement, safeguarding |

Accessibility is built in rather than retrofitted: 20px base type in `rem` with an A / A+ / A++ control, AAA contrast in light and dark, 48px targets, no hover-dependent behaviour, a labelled **Menu** button on mobile, wide tables reflowing to cards below 640px, colour never the only signal, and print stylesheets. See [`client/src/index.css`](client/src/index.css) and [`tailwind.config.ts`](tailwind.config.ts), where those rules live as tokens.

Not yet built: the league data sync (fixtures and results are entered by hand until then), the members' area, and the axe-core CI gate. See the implementation plan.

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
npm run seed              # placeholder editorial content (pages, FAQs, links)
npm run import:league     # all ten clubs, their venues, teams and squads, from the league site
```

**The seeded content is placeholder.** It exists so the layout and the empty states can be judged against something realistic. Replace it in the Directus admin panel before the site goes anywhere near the public — the club's real name, address, fees, committee and history are things only the club can supply.

| Path | What it is |
|---|---|
| [`directus/src/schema/definitions.ts`](directus/src/schema/definitions.ts) | The 24 collections — the source of truth for the data model |
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
