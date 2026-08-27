# Product Requirements Document
## Hertford & District Table Tennis League — website rebuild

**Version:** 0.1 (draft for committee review)
**Date:** 26 August 2026
**Author:** prepared for the HDTTL committee
**Status:** Draft — four blocking decisions settled 26 Aug 2026; see [04-open-questions.md](04-open-questions.md) for the rest

**Decisions in force:** full database export available · Directus Cloud (managed) · all phases in scope, ~18 weeks · "new look, same map" — modern redesign, unchanged information architecture and page names

---

## 1. Summary

Replace hertsttl.org.uk — currently a FrontPage/Classic ASP site on IIS with no HTTPS, no mobile support and password‑free admin access — with a modern, accessible, phone‑friendly site backed by a proper content and data platform.

**Stack:** Directus (headless CMS + database + API + admin UI) as the backend; Nuxt 4 / Vue 3 as the frontend, deployed as a mostly‑static site with on‑demand regeneration.

**Primary design constraint:** the majority of users are older adults. Every decision about typography, colour, interaction, wording and error handling is made for a 70‑year‑old on a five‑year‑old Android phone or a laptop in a draughty sports hall, not for a designer's portfolio.

---

## 2. Why now

1. **Security.** No HTTPS (finding A1) and password‑free admin (A2) are not acceptable in 2026. Browsers warn on the site today.
2. **Legal.** Player contact details, including juniors', are effectively public with no privacy notice (A3).
3. **Reach.** No page on the site is usable on a phone (B1). Anyone under 60 checking a fixture on the way to a match gives up.
4. **Recruitment.** The league's own feedback page states that player numbers have fallen for years — and that same feedback form is switched off because of spam (C6). The site is currently an obstacle to growth rather than a channel for it.
5. **Continuity.** The site is one volunteer's institutional knowledge encoded in FrontPage, hand‑edited HTML and a WSH script. If that person stops, the league loses its records. The Hall of Fame going back to 1970 exists in a single 122 KB HTML file.

---

## 3. Goals and non‑goals

### Goals

| # | Goal | Measure |
|---|---|---|
| G1 | Every page works well on a phone | 100% of pages responsive; Lighthouse mobile ≥ 90 |
| G2 | Accessible to older users | WCAG 2.2 AA throughout; AAA for text contrast (7:1) and target size (44×44 CSS px min, 48px default) |
| G3 | Fast on old devices and poor connections | LCP < 2.5s on simulated 4G / mid‑tier Android; < 100 KB JS on content pages |
| G4 | Secure | HTTPS everywhere, HSTS; no unauthenticated write path; passwordless‑but‑verified auth |
| G5 | Legally sound | Privacy notice, lawful basis recorded, PII never in a public API response, erasure route |
| G6 | Captains can file a result in under 3 minutes on a phone | Timed with real captains in usability testing |
| G7 | The committee can update content without the webmaster | ≥ 80% of routine updates done via Directus by non‑technical committee members |
| G8 | No historic data is lost | Honours 1970–present, and all archived tables/averages/results, migrated and queryable |
| G9 | Support recruitment | A "New to the league?" journey with a working, spam‑resistant enquiry form |
| G10 | Old links keep working | 301 redirects for every current URL; zero 404s from external inbound links |

### Non‑goals (this phase)

- Live in‑match point‑by‑point scoring
- A mobile app (a Progressive Web App covers the need)
- Ticketing or payment processing (tournament fees stay cash on the night unless decided otherwise — see Q7)
- Replacing Table Tennis England's Sport80 membership system
- Social features — forums, comments, chat
- Multi‑league / white‑label platform. Build for this league; keep the model clean enough that it *could* generalise later

---

## 4. Users

| Persona | Age | Device | Needs | Current pain |
|---|---|---|---|---|
| **Barbara, 72 — league player** | 65–85 | iPad, occasionally a Windows laptop | When and where is my next match? Who am I playing? What's my average? | Text too small, menu won't open on the iPad, fixture grid unreadable |
| **Colin, 68 — team captain** | 55–75 | Android phone in the hall, laptop at home | File tonight's result; check who's eligible; find the opposition captain's number | Must go home to a desktop; the scorecard form is a Word document |
| **Andy, 61 — match secretary** | 50–70 | Laptop | Chase missing cards; set handicaps; run the cup draw; fix a wrong score | Everything routes through him and the webmaster |
| **Jo, 58 — chairperson / committee** | 45–70 | Laptop, phone | Post a notice, publish minutes, upload the handbook | Must email the webmaster and wait |
| **Sunil, 44 — new player enquiring** | 25–55 | Phone | Is there a club near me? What standard? Who do I contact? | No join journey; enquiry form disabled |
| **The webmaster** | — | Desktop | Publish without hand‑editing HTML; not be the single point of failure | FrontPage, WSH scripts, manual file copying each season |

**Accessibility profile of the core audience.** Assume as the default case, not the edge case: presbyopia and reading glasses; reduced contrast sensitivity; some hearing loss; mild tremor or arthritis affecting tapping accuracy; low confidence with unfamiliar interfaces and a strong aversion to "breaking something"; heavy reliance on printing; a real chance of a screen reader or 200% browser zoom in use.

---

## 5. Static vs dynamic — the core architectural analysis

This is the question the rebuild turns on. Every page is classified into one of three tiers, and each tier gets a different rendering strategy.

### Tier A — Static, built at deploy time

Content that changes a few times a season or never. Rendered to HTML at build time and served from a CDN. No database call on the request path.

| Content | Source | Rebuild trigger |
|---|---|---|
| About the league / 90‑year history | Directus `pages` | On publish |
| How the league works (divisions, points, tie‑breaks, rule 20) | Directus `pages` | On publish |
| Cup formats and rules | Directus `competitions` | On publish |
| New to the league? / How to join | Directus `pages` | On publish |
| Committee and contacts (roles and public addresses only) | Directus `committee_roles` | On publish |
| Constitution, handbook, registration form, AGM minutes | Directus `documents` | On upload |
| Sponsors and links | Directus `sponsors` | On publish |
| Privacy notice, accessibility statement, cookie notice | Directus `pages` | On publish |
| **Historic archives** — past seasons' tables, averages, results, Roll of Honour, Hall of Fame 1970– | Directus, queried at build | Season rollover only |

The Hall of Fame is the clearest case: 56 years of data that changes once a year. It should be a fast static page with search and filtering done client‑side, never a database query.

### Tier B — Dynamic data, statically cached, regenerated on change

The heart of the site. The data is genuinely dynamic — but it changes *on an event* (a result is confirmed), not continuously. So render it statically and regenerate the affected pages when the event fires (Incremental Static Regeneration with on‑demand revalidation, driven by a Directus Flow webhook). Visitors always get a CDN‑fast page; the page is never stale by more than a few seconds after a result lands.

| Page | Regenerated when | Fallback TTL |
|---|---|---|
| League tables (per division, and combined) | A match card is confirmed | 10 min |
| Fixtures & results (per division, per team, per week) | Card confirmed, or fixture rescheduled | 10 min |
| Individual match scorecard view | Card confirmed or amended | 60 min |
| Player averages | Card confirmed | 10 min |
| Handicaps | Match secretary publishes handicaps | 60 min |
| Club pages (venue, teams, roster — **no contact details**) | Registration or club detail changes | 60 min |
| Cup draws, rounds and results | Draw made or cup result confirmed | 10 min |
| News, notices, newsletters | On publish / on expiry | 15 min |
| Home page | Any of the above | 10 min |
| Player profile pages | Card confirmed | 60 min |

**Why not simply server‑render everything on request?** Because the traffic pattern is spiky (a burst on match nights and the morning after), the hosting budget is a volunteer league's, and the audience includes people on slow connections. Static‑with‑revalidation gives near‑zero server cost, resilience if Directus is down for maintenance, and the fastest possible first paint — while still being accurate within seconds. It also degrades gracefully: if the webhook fails, the TTL still refreshes the page.

### Tier C — Truly interactive, live API, authenticated

Rendered client‑side against the Directus API, behind login. Never cached.

| Feature | Who | Notes |
|---|---|---|
| Result / scorecard entry and amendment | Team captains | The most important interactive flow on the site |
| Confirm or dispute an opponent's card | Opposing captain | |
| Match secretary console — chase, correct, void, reschedule | Match secretary | Mostly done inside Directus admin, not a custom UI |
| Postponement / rearrangement request | Captains | |
| Closed Championship entry | Players | Multi‑event entry with partner selection |
| Handicap Cup entry | Players | |
| "My team" personalised view | Any logged‑in player | Next fixture, my results, my average, my teammates |
| Captain's contact directory | Logged‑in players only | Replaces "LogIn to see" with a real gate |
| Enquiry / feedback form | Public | Rate limited, honeypot + Turnstile, moderated queue |
| Committee content editing | Committee | Directus admin UI — no custom build needed |

### Summary

| Tier | Share of pages | Rendering | Cost |
|---|---|---|---|
| A — Static | ~35% | SSG at build | Free (CDN) |
| B — Dynamic, cached | ~55% | ISR + webhook revalidation | Near‑free |
| C — Interactive | ~10% | Client‑side, authenticated | Directus API only |

Roughly 90% of all page views will be served as static HTML from a CDN with no database involvement.

---

## 6. Functional requirements

### 6.1 Public — no login

- **FR‑1** View league tables per division, showing Played, Won, Drawn, Lost, Games For, Games Against, Points — an expansion on today's Played/Points only — with the tie‑break rule explained in plain English and applied visibly.
- **FR‑2** View fixtures by division, by team, by club, by venue and by date. A "this week" view on the home page.
- **FR‑3** View results, including the full scorecard: each rubber, each set score, doubles.
- **FR‑4** View player averages, filterable by division and club, with the 50% participation eligibility rule shown as a badge rather than as grey text alone (fixes B4).
- **FR‑5** View handicaps, by club and by player.
- **FR‑6** View cup competitions: format, rules, draw, bracket, results, finals date and venue.
- **FR‑7** View club pages: venue with map and directions, parking, accessibility of the venue itself (step‑free access, toilets, hearing loop — this audience needs to know), home night, teams, roster.
- **FR‑8** View player profiles: current season record, career record across migrated seasons, honours won.
- **FR‑9** Read news, notices and newsletters.
- **FR‑10** Download documents: constitution, handbook, registration form, minutes, blank scorecards.
- **FR‑11** Browse historic archives: past seasons' tables, averages and results; Roll of Honour by season; Hall of Fame 1970–present, searchable by name, team and competition.
- **FR‑12** Search the whole site from a single box.
- **FR‑13** Submit an enquiry ("I'd like to play") or feedback, with spam protection so the channel can stay open (fixes C6).
- **FR‑14** Download fixtures to a calendar — `.ics` per team, per division and per club, plus a subscribable feed URL that updates when fixtures move.
- **FR‑15** Print any table, fixture list or scorecard cleanly via an on‑page Print button and a dedicated print stylesheet (fixes D4).

### 6.2 Logged‑in player

- **FR‑16** Sign in by email magic link (no password to remember — see §8).
- **FR‑17** See captain and club contact details.
- **FR‑18** Choose "my team" and "my club"; the home page then leads with the user's own next fixture and latest result.
- **FR‑19** Enter the Closed Championships and Handicap Cup online, including doubles partner selection.
- **FR‑20** Opt in to a fixture reminder email the day before a match.
- **FR‑21** View and correct their own personal data; request erasure.

### 6.3 Team captain

- **FR‑22** Enter a match result as a scorecard: select players for both sides from the eligible roster, enter set scores rubber by rubber, with running totals calculated automatically.
- **FR‑23** Have eligibility warnings surfaced at entry time — a player who has played up, a cup‑rule breach ("you may only play for one team per cup"), a player not registered — as a clear warning, not a silent failure.
- **FR‑24** Save a card as a draft and finish later, including offline in a hall with no signal, syncing on reconnection.
- **FR‑25** Submit a card; the opposing captain is emailed to confirm or dispute within a set window; the match secretary is notified either way.
- **FR‑26** Request a postponement or rearrangement, with the match secretary approving.
- **FR‑27** See which of their team's cards are outstanding.

### 6.4 Match secretary and committee

- **FR‑28** Create and edit seasons, divisions, clubs, teams, venues, registrations and fixtures.
- **FR‑29** Generate a fixture calendar for a division (replacing the WSH script), including cup weeks and holiday blanks.
- **FR‑30** Confirm, amend, void or force a result; the standings and averages recalculate automatically and the affected pages regenerate.
- **FR‑31** Set and publish handicaps for the season.
- **FR‑32** Run cup draws and record cup results.
- **FR‑33** Publish news, notices, newsletters, minutes and documents without the webmaster.
- **FR‑34** Manage the Closed Championship: events, dates, venue, entries, seeding, results, and the Roll of Honour that follows.
- **FR‑35** Moderate the enquiry/feedback queue.
- **FR‑36** Export data: entry lists, contact lists, results — as CSV for spreadsheets and mail merges.
- **FR‑37** See an audit trail of who changed what (Directus revisions, built in).
- **FR‑38** Roll the season over with one action: archive the current season, create the next, carry clubs and venues forward.

---

## 7. Design requirements — building for older users

This section is normative, not advisory. It is the reason the project exists in the form it does.

### 7.1 Typography

- Base font size **20px** (`1.25rem`); body text never below 18px; the smallest text anywhere on the site — captions, footnotes — is 16px. Today's 8pt table data is roughly 11px.
- All sizing in `rem`, never `pt` or `px`, so browser zoom and OS text size settings work correctly.
- A humanist sans‑serif with open apertures and unambiguous `l`/`I`/`1` — Atkinson Hyperlegible (designed for low vision), with Inter or the system stack as fallback. **Comic Sans is retired.**
- Line height 1.6 for body, 1.3 for headings. Measure capped at 70 characters.
- No all‑caps runs longer than two words. No letter‑spaced display text. No italics used to carry meaning (fixes B4).
- Numerals tabular‑lining in all tables so columns align.

### 7.2 Colour and contrast

- Body text contrast ratio **≥ 7:1** (WCAG AAA), large text ≥ 4.5:1, UI components and focus indicators ≥ 3:1.
- The palette carries the league's identity but is rebuilt for legibility — deep green/navy and a warm accent on near‑white and near‑black surfaces. Crimson‑on‑salmon and gold‑on‑beige are gone.
- **Colour is never the only signal.** Win/loss, home/away, cup week, holiday, ineligible player — each gets a text label or an icon with a text alternative alongside any colour.
- Light and dark themes, both meeting the same ratios, following the OS preference with a manual override.
- A high‑contrast mode toggle for users who need more than AAA.

### 7.3 Interaction

- **No hover‑dependent behaviour anywhere** (fixes B2). Everything opens on click or tap and is reachable by keyboard. Tooltips become inline expandable "What does this mean?" disclosures.
- Touch targets **48×48 CSS px minimum** with at least 8px between them. WCAG 2.2 target‑size AAA.
- Focus indicators are thick (3px), high contrast, and never removed.
- One clear primary action per screen, styled as a large filled button with a verb label — "Enter tonight's result", not "Submit".
- No modals unless unavoidable; no carousels; no auto‑playing media; no infinite scroll; no time‑limited sessions that expire mid‑form.
- All animation respects `prefers-reduced-motion`; decorative animated GIFs are removed (fixes C1).
- Destructive actions require confirmation and are always undoable or correctable.

### 7.4 Navigation and wording

**Binding constraint — "new look, same map" (decision Q8).** The information architecture and the page names do not change. Every page keeps the name players already use, in the place they already look for it. Where the audit recommended clearer wording, it is added as a **subtitle beneath the existing name**, never as a replacement: "League Tables" gains "Who's top of each division", it does not become "Standings". Old URLs redirect to pages carrying the same name and the same content, so a years‑old bookmark lands somewhere recognisable rather than merely somewhere valid. What changes is type, contrast, spacing, layout, mobile behaviour, interaction and print support.

- Top navigation limited to five entries: **Home · Fixtures · Tables · Clubs · More**. These are *grouping* labels drawn from the league's existing vocabulary — the destination pages beneath them keep their current names ("League Tables", "Fixture Calendar", "Club Details", "Match History"). On mobile, a large labelled "Menu" button — never a bare hamburger icon.
- Home page presents large tappable cards for the six things people actually come for: This week's matches · Latest results · League tables · Find a club · Averages · News.
- A persistent, obvious "Back to Home" on every page, honouring the existing site's most‑used affordance.
- Breadcrumbs on every page below the top level.
- **Plain English as subtitles, not replacements.** Existing page names stay; a one‑line explanation sits beneath each — "League Tables / Who's top of each division", "Match History / Every match your team has played". Only *new* controls that have no existing name get plain‑English wording from scratch — "Enter a result", not "Input scorecard". No jargon, no abbreviations without expansion on first use.
- Error messages state what happened, why, and exactly what to do next, in the second person, next to the field concerned. Never a code, never "invalid input".

### 7.5 Comprehension aids

- A user‑facing text‑size control (A / A+ / A++) in the header, persisted to `localStorage`. Older users frequently do not know browser zoom exists; the site should not assume they do.
- Every table has a one‑sentence plain‑English explanation above it ("This shows how many matches each team has played and how many points they have. Most points at the top.").
- The tie‑break rule, the 50% averages rule and the cup eligibility rule are explained in plain language wherever their effects are visible — extending a genuine strength of the current site.
- A "Help with this page" link in the footer of every page, and a short "How do I…?" section covering the ten most common tasks with screenshots.
- Wide tables reflow to stacked cards below 640px rather than scrolling horizontally. The 16‑column fixture grid becomes a week‑by‑week list on a phone.

### 7.6 Resilience

- All Tier A and Tier B pages are fully readable with JavaScript disabled or failed.
- Works on browsers two major versions old, and on iOS Safari back to version 15.
- Offline support (PWA) for fixtures, tables and draft scorecards — sports halls have poor signal.
- No dependency on a third‑party CDN at runtime; fonts self‑hosted.

---

## 8. Security, privacy and compliance

| Requirement | Approach |
|---|---|
| HTTPS everywhere (fixes A1) | Let's Encrypt / platform‑managed certificate, HSTS, HTTP→HTTPS 301 |
| Real authentication (fixes A2) | Directus auth. Primary flow: **email magic link** — the user types their email as they do today, but receives a one‑time signed link, so possession of the mailbox is actually proven. Optional password for frequent admin users. TOTP two‑factor mandatory for admin and match‑secretary roles |
| No PII in public responses (fixes A3) | Directus field‑level permissions. The public role cannot read `people.email`, `people.phone` or `people.date_of_birth` at all — the API does not return them, rather than the frontend hiding them |
| Forms use POST (fixes A4) | All mutations POST/PATCH over TLS |
| Junior data | Separate consent flag and parental consent record; junior contact details visible only to the match secretary and the relevant club's captains |
| Privacy notice | Published page stating controller, lawful basis (legitimate interest for league administration; consent for marketing email), categories, retention, rights, contact |
| Retention | Personal contact data purged N seasons after a player's last registration (default 3, committee to confirm — Q10). Results and honours retained indefinitely as league records, under name only |
| Erasure | Self‑service request route; committee workflow to action it |
| Spam (fixes C6) | Cloudflare Turnstile + honeypot + per‑IP rate limit + moderation queue. No public form writes directly to a published surface |
| Secrets | No credentials in the repo; environment variables via the hosting platform |
| Backups | Nightly Postgres dump, 30 days retained, off‑site, with a documented and **tested** restore |
| Rate limiting | On the Directus API and on all public form endpoints |
| Bus factor | Everything in Git; infrastructure as code; two committee members hold admin credentials; a written runbook |

---

## 9. Technology stack

### Backend — Directus

| Concern | Choice | Rationale |
|---|---|---|
| Platform | Directus 11+ | Gives a database, REST + GraphQL API, role/field‑level permissions, file storage, a workflow engine and a genuinely usable admin UI in one product. The committee edits content directly; no bespoke CMS to build or maintain |
| Database | PostgreSQL 16 | Directus's best‑supported engine; window functions make standings and averages straightforward |
| Computation | Directus **Flows** | Recalculate standings and averages on card confirmation; send confirmation and reminder emails; fire the frontend revalidation webhook; nightly integrity checks |
| Files | Directus file library, S3‑compatible storage | PDFs, logos, sponsor images |
| Auth | Directus auth, magic link + optional password, TOTP for elevated roles | |
| Hosting | **Directus Cloud** (decided) | Managed. Patching, backups and uptime are not a volunteer's responsibility |

### Frontend — Vue

| Concern | Choice | Rationale |
|---|---|---|
| Framework | **Nuxt 4** (Vue 3, TypeScript) | Per‑route control of static vs server vs client rendering maps exactly onto the Tier A/B/C analysis in §5. Server rendering means content is readable without JavaScript — essential for this audience and for SEO |
| Rendering | Nitro route rules: `prerender` for Tier A, `isr` with on‑demand revalidation for Tier B, `ssr: false` islands for Tier C | |
| Styling | Tailwind CSS v4 with a locked design‑token layer | Tokens make the AAA contrast and 20px base enforceable rather than aspirational |
| Components | Nuxt UI (Reka UI primitives) | Accessible‑by‑default focus management, keyboard handling and ARIA — the hard parts of §7.3 |
| Data access | `@directus/sdk`, typed from a generated schema | |
| Data fetching | `useAsyncData` for rendered pages; TanStack Query for the interactive scorecard | |
| Forms | Zod schemas shared between client and server, with VeeValidate | One definition of validity, one set of plain‑English messages |
| Tables | Semantic `<table>` with TanStack Table for sorting; card reflow below 640px | |
| Offline | `@vite-pwa/nuxt` — cache fixtures, tables and draft cards | |
| Images | Nuxt Image — AVIF/WebP, correct sizing, lazy loading | |
| Search | Client‑side index (MiniSearch) built at deploy for Tier A/B content | No search server to run |
| Email | Directus + a transactional provider (Postmark / Resend) | |
| Analytics | Plausible or Umami, cookieless | No consent banner needed; the audience should not be shown one |

### Delivery

| Concern | Choice |
|---|---|
| Repo | Single Git repository — frontend, Directus schema snapshots, migrations, ETL scripts, docs |
| CI | GitHub Actions: typecheck, lint, unit tests (Vitest), end‑to‑end tests (Playwright), **axe‑core accessibility tests**, Lighthouse CI budgets |
| Environments | Local (Docker Compose) → staging (`beta.hertsttl.org.uk`) → production |
| Hosting | Cloudflare Pages / Netlify / Vercel for the frontend; Directus alongside |
| Monitoring | Uptime check, error tracking (Sentry), weekly Lighthouse report |

### Why not simpler alternatives?

- **WordPress.** Would handle news and pages, but the league's core is relational sports data — fixtures, rubbers, standings, eligibility rules. Modelling that in WordPress means custom post types fighting the grain, and the plugin surface is a security liability for a volunteer‑run site.
- **A spreadsheet plus a static generator.** Cheap, but no captain result entry, no permissions, no audit trail, and it recreates the current single‑maintainer problem.
- **Plain Vue SPA with no SSR.** Loses the no‑JavaScript fallback, hurts first paint on old phones, and hurts search visibility — all three matter disproportionately for this audience.

---

## 10. Success metrics

| Metric | Baseline (current) | Target (6 months post‑launch) |
|---|---|---|
| Mobile‑usable pages | 0% | 100% |
| Lighthouse mobile performance | not measurable (no viewport) | ≥ 90 |
| Lighthouse accessibility | est. < 60 | ≥ 95, plus zero axe violations |
| WCAG conformance | none | 2.2 AA verified, AAA for contrast and target size |
| HTTPS | broken | 100%, HSTS enabled |
| Results filed within 48h of the match | unknown — assume ~60% | ≥ 90% |
| Results filed from a phone | 0% | ≥ 50% |
| Content updates made without the webmaster | ~0% | ≥ 80% |
| Enquiries from prospective players | 0 (form disabled) | ≥ 2 per month in season |
| Broken links | ≥ 3 known | 0 |
| Historic honours preserved and searchable | file only | 1970–present, queryable |

---

## 11. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| ~~Existing database is inaccessible~~ — **retired**, a full export is available | — | — | Migration is now a documented transform from a known schema. The audit's scraper is kept as a reconciliation check: migrated data must agree with what the public pages display |
| Exported schema turns out to be undocumented or inconsistent | Medium | Medium | Schema documentation is an explicit Phase 0 deliverable, before any ETL is written; reconciliation against the scrape catches silent losses |
| Captains resist a new results process | Medium | High | Involve three captains from week one; run the old and new entry paths in parallel for one half‑season; provide a printed one‑page guide; keep a phone/email fallback to the match secretary |
| Older users find the new site harder despite the effort | Medium | High | Usability test with five real players aged 60+ at prototype stage and again before launch; keep URL structure and page names familiar; keep "Back to Home" |
| Volunteer capacity — nobody to run it after launch | High | High | Choose managed hosting; document everything; train two committee members; keep the operational surface deliberately small |
| Ongoing cost falls on the league | Medium | Medium | Target under £250/year; present costed options (§12); sponsor slots already exist on the site |
| Season rollover is the annual crunch | High | Medium | Make rollover a single tested, rehearsed action (FR‑38), not a manual file copy |
| Scope creep into a general league platform | Medium | Medium | Non‑goals in §3 are binding for phase 1 |
| Data quality in the archives (mojibake, inconsistent names) | High | Low | Normalise during ETL; a name‑reconciliation review step with the match secretary |

---

## 12. Indicative cost

**Selected: managed (Directus Cloud).**

| Item | Managed *(selected)* | Self‑hosted *(not taken)* |
|---|---|---|
| Directus | Directus Cloud from ~$15/mo | VPS €6–12/mo (Hetzner/DO), Docker |
| Frontend hosting | Free tier (Cloudflare Pages / Netlify) | Same |
| Database | Included | Included on the VPS |
| Transactional email | Free tier (< 3k/mo) | Same |
| Object storage | Included | ~€1/mo |
| Domain | Existing | Existing |
| TLS | Free | Free |
| **Annual total** | **~£180–250** | ~£90–160 |

The extra ~£100/year buys away patching, backups and uptime monitoring — which is where the real risk sits for a volunteer‑run league. The existing Plesk/Windows hosting can be retired once the frozen legacy site is decommissioned, which recovers part of that cost.

---

## 13. Out of scope but worth noting

- A parallel Table Tennis England data sync (Sport80) — would remove double entry of memberships, but requires TTE cooperation.
- Live scoring / streaming from finals night.
- A league‑wide player rating system (ELO‑style) beyond simple averages.
- Merging with neighbouring leagues' fixtures for inter‑league events — mentioned as an idea on the current feedback page.

---

## Related documents

- [00-site-audit.md](00-site-audit.md) — full inventory and findings
- [02-data-model.md](02-data-model.md) — Directus collections, fields, roles, flows
- [03-implementation-plan.md](03-implementation-plan.md) — phases, deliverables, sequencing
- [04-open-questions.md](04-open-questions.md) — decisions needed from the committee
