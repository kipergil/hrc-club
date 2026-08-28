# HRC Club Website — Implementation Plan

Seven phases, about eleven weeks of part-time work, with a public site up at the end of week five.

**Phases 0 to 2 are built.** The site runs: 36 routes, of which 53 pages (every route plus every team, player, article, event and venue) are prerendered at build time from live Directus data. What remains is the league sync (Phase 3), the members' area (Phase 4), the accessibility test gate (Phase 5), and real content in place of the placeholder seed (Phase 6).

Sequencing rule: **the site is deployable and useful at the end of every phase**. There is no phase whose absence leaves a broken site, because a volunteer project that stalls halfway should stall on something that works.

---

## Phase 0 — Foundations (1 week)

| # | Task | Status |
|---|---|---|
| 0.1 | Directus collections modelled and applied under the `hrc_club` folder | **Done** |
| 0.2 | Schema-as-code in `directus/`, idempotent and re-runnable | **Done** |
| 0.3 | Shared enums in `shared/enums.ts` | **Done** |
| 0.4 | Permission policy and role written | **Done** — needs running |
| 0.5 | Run `permissions:apply`; `HRC Club Service` role, policy and service account provisioned | **Done** |
| 0.6 | Repo scaffold: `client/`, `server/`, `api/`, `shared/`, Vite + Tailwind, mirroring pintogather's layout | **Done** |
| 0.7 | Vercel project, environment variables, preview deploys from PRs | To do |
| 0.8 | GitHub Actions CI: typecheck, Vitest, build | **Done** |
| 0.9 | Clerk application (development instance only for now) | To do — Phase 4 |

**Done when** an empty-but-deployed site builds from `main` and CI is green on a pull request.

Verified: the service token can read the club's collections, cannot read a member's `email` or `phone` even when it asks Directus directly, cannot read an enquiry back, and cannot see another project's collections at all.

## Phase 1 — Design system and the static site (2 weeks) — **built**

The accessibility requirements are cheap now and expensive later, so they come first.

| # | Task |
|---|---|
| 1.1 | Tailwind token layer: 20px base in `rem`, the type scale, the AAA-contrast palette in light and dark, 48px touch-target spacing. Tokens, not utilities sprinkled at call sites |
| 1.2 | Atkinson Hyperlegible self-hosted, with a real fallback stack — *outstanding: the fallback stack is in place, the woff2 files are not* |
| 1.3 | App shell: header, five-entry menu, mobile **Menu** button (labelled, never a bare hamburger), breadcrumbs, footer, "Back to home" on every page |
| 1.4 | Text-size control (A / A+ / A++) persisted to `localStorage` |
| 1.5 | Prerender pipeline: build step that walks the Tier A route list, fetches from Directus, `renderToString`, writes `dist/public/<route>/index.html` |
| 1.6 | Tier A routes: `/about`, `/about/history`, `/play`, `/play/venue/:slug`, `/join`, `/coaching`, `/juniors`, `/committee`, `/documents`, `/honours`, `/sponsors`, `/links`, `/help`, `/privacy`, `/accessibility`, `/safeguarding` |
| 1.7 | `/api/files/:id` asset proxy |
| 1.8 | Committee enters the real content for those pages in Directus |

**Done when** every Tier A route renders correct content with JavaScript disabled, and axe-core reports no violations on any of them.

**This is the first genuinely useful milestone.** A club site that answers "when and where do you play, what does it cost, how do I join" is already better than most, and it is live at the end of week three.

## Phase 2 — Club-owned dynamic content (2 weeks) — **built, less the Flows**

Flows (2.9, 2.10) are specified but not provisioned: they need the deployed origin and the Vercel deploy hook, which is Phase 0.7.

| # | Task |
|---|---|
| 2.1 | Express BFF: route structure, Directus client with the service token, `Cache-Control` policy per tier |
| 2.2 | TanStack Query setup, shared `api-client.ts`, Zod response schemas in `shared/` |
| 2.3 | News: `/news`, `/news/:slug`, pinning, expiry |
| 2.4 | Events: `/events`, `/events/:slug` |
| 2.5 | Teams and squads: `/teams`, `/teams/:slug` (without league data yet) |
| 2.6 | Players: `/players`, `/players/:slug`, honouring `show_on_site` |
| 2.7 | Gallery: `/gallery`, `/gallery/:slug`, with captions as alt text |
| 2.8 | Home page: six cards, announcement banner |
| 2.9 | Directus Flows: publish rebuild, enquiry notification, enquiry acknowledgement, announcement expiry |
| 2.10 | Vercel Deploy Hook wired to the rebuild flows, debounced |

**Done when** the committee can publish a news item in the admin panel and see it live, unaided, in under two minutes.

## Phase 3 — League data (2 weeks)

The one phase with real technical risk, which is why it sits after the site is already useful.

| # | Task |
|---|---|
| 3.1 | `LeagueAdapter` interface; normalised fixture, standing and player-stat shapes in `shared/` |
| 3.2 | `ScrapeAdapter` — parses `Calendarz.asp`, `Tables.asp`, `Averages.asp` and `MatchHistory.asp?Team=HRC+*` for the three teams. Windows-1252 decoding, defensive parsing, snapshot tests against saved fixtures of the real HTML |
| 3.3 | Upsert on `league_fixture_ref`; the sync writes only columns it owns, never `report` |
| 3.4 | `POST /api/sync/league` behind a shared secret; scheduled via Vercel Cron |
| 3.5 | Sync report: rows created/updated/skipped, and a loud failure when the parse yields zero fixtures — silence is the failure mode that matters |
| 3.6 | `/fixtures`, `/results`, `/results/:id`, `/tables`, `/averages`, `/seasons/:label/*` |
| 3.7 | Tables and averages reflow to cards below 640px; plain-English explanation above each; the 50% participation rule explained where its effect shows |
| 3.8 | Match reports: link an `hrc_news` article to a fixture, surfaced on the match page |

**Risk and mitigation.** The scrape depends on markup nobody has promised to keep stable, and the league site is being rebuilt in parallel — the scrape may have a shelf life measured in months. That is acceptable because the adapter interface is the deliverable and the scraper is one implementation of it. Manual entry in the admin panel remains available throughout and is the documented fallback. **The site must never require the sync to work.**

**Done when** a result entered on the league site appears on the club site within an hour, and the sync failing leaves the last good data in place with a visible "last updated" stamp.

## Phase 4 — Members area (1.5 weeks)

| # | Task |
|---|---|
| 4.1 | Clerk integration, client and server, mirroring pintogather's `clerkAuth.ts` |
| 4.2 | Link a Clerk identity to an `hrc_members` row via `clerk_user_id`, just-in-time on first sign-in |
| 4.3 | `/members` — my team, my next fixture, my record this season |
| 4.4 | `/members/directory` — the one place contact details are served, on an authenticated path |
| 4.5 | `/members/documents` — documents where `is_public` is false |
| 4.6 | `private, no-store` on everything under `/api/members` |

**Done when** a member signs in and sees their own record, and no unauthenticated request can reach a contact detail. That second half gets an explicit test.

## Phase 5 — Enquiries, resilience and the accessibility gate (1.5 weeks)

| # | Task |
|---|---|
| 5.1 | `/contact` and the join form → `POST /api/enquiries`, honeypot field, rate limit, plain-English validation messages next to the field |
| 5.2 | Error pages that say what happened and what to do next; a real 404 with useful links |
| 5.3 | PWA: cache fixtures, tables and the timetable — sports halls have poor signal |
| 5.4 | Print stylesheets for fixtures, the timetable and the squad list. Captains print these |
| 5.5 | axe-core tests over every prerendered route, in CI, failing the build — *the only part of Phase 5 not yet started that changes CI* |
| 5.6 | Lighthouse CI budgets: performance and accessibility |
| 5.7 | Keyboard-only walkthrough of every interactive route; no hover-dependent behaviour anywhere |
| 5.8 | Manual check at 200% zoom and with a screen reader on the six highest-traffic pages |

**Done when** CI fails on an accessibility regression, and the checks in 5.7 and 5.8 have been done by a person, not inferred from a score.

## Phase 6 — Content, honours and launch (1 week)

| # | Task |
|---|---|
| 6.1 | Load the real content listed in [01-content-inventory.md](01-content-inventory.md) §5 |
| 6.2 | Back-fill `hrc_honours` from the club's records — the one job worth doing properly, because nobody else will |
| 6.3 | Member consent pass: `show_on_site` ticked only where a member has agreed |
| 6.4 | Redirects from any existing club URLs |
| 6.5 | Custom domain, HTTPS, analytics (cookieless — no consent banner for this audience) |
| 6.6 | A one-page written handover: how to publish news, how to put up the cancellation banner, how to roll a season over |
| 6.7 | Launch |

**Done when** a committee member who has never seen the admin panel can publish a notice using the handover page alone.

## Cross-cutting: the accessibility gate

Nothing merges that regresses any of these, and they are checked in CI rather than at review:

- 20px base type, nothing below 16px
- Body-text contrast ≥ 7:1
- No hover-dependent behaviour
- 48×48px touch targets
- Every Tier A and Tier B route readable with JavaScript off
- Tables reflow to cards below 640px
- `prefers-reduced-motion` respected

## Timeline

| Phase | Weeks | Cumulative | Public at this point |
|---|---|---|---|
| 0 — Foundations | 1 | 1 | Nothing |
| 1 — Design system + static | 2 | 3 | **When, where, cost, how to join** |
| 2 — Club dynamic content | 2 | 5 | **+ news, events, teams, players, photos** |
| 3 — League data | 2 | 7 | + fixtures, results, tables, averages |
| 4 — Members area | 1.5 | 8.5 | + members' area and directory |
| 5 — Enquiries and a11y gate | 1.5 | 10 | + contact form, offline, print |
| 6 — Content and launch | 1 | 11 | Launched |

### A leaner alternative

Phases 0, 1 and 2 alone — five weeks — give a complete, accurate, accessible club site with a timetable, news, teams and photos, and a link to the league site for fixtures and tables. If time or appetite runs short, **stop there**. It is a genuinely good outcome, and Phase 3 is the phase most likely to consume more time than it is worth.

## Open questions

| # | Question | Blocking? |
|---|---|---|
| 1 | What does HRC stand for, and what is the club's full formal name? Needed for `hrc_site_settings`, page titles and the footer | Phase 1 content only |
| 2 | Does the club have an existing website, and if so at what URL? Determines whether Phase 6.4 has any work in it | Phase 6 |
| 3 | Is the league willing to expose HRC's fixtures as data, or even a CSV, ahead of its own rebuild? A yes removes the scraper entirely | Phase 3 |
| 4 | Who on the committee will hold the webmaster role and edit content? A site with no editor is a site that goes stale in a season | Phase 6 |
| 5 | Members-area sign-in: is Clerk warranted for ~25 members, or is a single shared members' password enough? Clerk is the stack's default and is assumed here, but it is a real question at this scale | Phase 4 |
| 6 | Are there photographs and honours records worth digitising, and who holds them? | Phase 6 |
