# Implementation Plan

Companion to [01-prd.md](01-prd.md) and [02-data-model.md](02-data-model.md).

**Assumption:** one part‑time developer (roughly 2–3 days a week) plus committee time for content, review and testing. Adjust the calendar accordingly if resourcing differs — the *sequence* holds either way.

**Indicative duration:** ~18 weeks to full cutover, with a usable public site live in beta at week 9.

**Scope confirmed 26 Aug 2026:** all six phases are in scope. The lean alternative at the foot of this document is recorded for reference but is **not** being taken. Hosting is Directus Cloud; a full database export is available; the design direction is "new look, same map".

---

## Phase 0 — Discovery and setup (2 weeks)

**Goal:** remove every unknown that could stall a later phase.

| # | Deliverable |
|---|---|
| 0.1 | Access secured: existing Plesk/IIS hosting, the ASP database, DNS/registrar, the domain, the email addresses |
| 0.2 | **Database export obtained and its schema documented** — every table, column and relationship, mapped field by field onto [02-data-model.md](02-data-model.md). This is the gate on Phase 5's ETL and must be finished here, not deferred |
| 0.3 | Reconciliation baseline: the audit's scraper re‑run and stored, so migrated data can be checked against what the public pages currently display |
| 0.4 | Committee workshop: walk the audit findings, agree goals, sign off the remaining open questions in [04-open-questions.md](04-open-questions.md) |
| 0.5 | Three captains and three players aged 60+ recruited as a standing test panel |
| 0.6 | Directus Cloud account created; billing owner agreed; plan tier confirmed against expected traffic |
| 0.7 | Repository, CI skeleton, local Docker Compose (Directus + Postgres) for development |
| 0.8 | Baseline measurement of the current site — Lighthouse, axe, page weight, traffic if analytics exist — so improvement is provable |
| 0.9 | Design direction under the "new look, same map" constraint: the league identity rebuilt for legibility, with the existing page names and structure fixed as given |

**Exit criteria:** the source schema is documented and mapped, and every remaining open question is answered or explicitly deferred with an owner and a date.

---

## Phase 1 — Foundations (3 weeks)

**Goal:** the backend can hold the league, and the frontend can render it accessibly. Nothing public yet.

| # | Deliverable |
|---|---|
| 1.1 | Directus deployed to staging; Postgres provisioned; backups configured **and a restore tested** |
| 1.2 | Full schema from [02-data-model.md](02-data-model.md) built, committed as a versioned schema snapshot |
| 1.3 | Roles and permissions configured; **field‑level PII restrictions verified by hitting the public API and confirming the fields are absent** |
| 1.4 | Current season seeded by hand: 10 clubs, venues, 26 teams, 3 divisions, the 2026‑27 fixture list |
| 1.5 | Design system: tokens (20px base, AAA contrast palette, 48px targets, spacing scale), typography, core components — button, link, card, table, form field, alert, badge, disclosure |
| 1.6 | Accessibility test harness in CI: axe‑core on every route, Lighthouse budgets, keyboard‑only Playwright journeys |
| 1.7 | Nuxt 4 skeleton with route rules encoding the Tier A/B/C split; Directus SDK wired with generated types |
| 1.8 | Deploy pipeline: push → staging; manual promote → production |

**Exit criteria:** a styled, empty site deploys automatically and passes the accessibility gate. The design system is reviewed by two members of the test panel on their own devices.

---

## Phase 2 — Public read‑only site (4 weeks)

**Goal:** everything a visitor can do today, done better. Launch to beta.

| # | Deliverable | Tier |
|---|---|---|
| 2.1 | Home page — this week's matches, latest results, six large navigation cards, current announcement | B |
| 2.2 | League tables per division, with expanded columns and the tie‑break explainer | B |
| 2.3 | Fixtures & results — by division, team, club, venue, date; "this week" and "my team" views | B |
| 2.4 | Scorecard view — full rubber‑by‑rubber detail | B |
| 2.5 | Club pages — venue, map, directions, **venue accessibility information**, teams, roster | B |
| 2.6 | Player averages with the eligibility badge | B |
| 2.7 | Handicaps | B |
| 2.8 | Cup pages — format, rules, draw, bracket, results | B |
| 2.9 | News, notices, newsletters | B |
| 2.10 | Documents library with superseded‑edition handling | A |
| 2.11 | Static content — about, how the league works, join us, committee, privacy, accessibility statement | A |
| 2.12 | Site search | A |
| 2.13 | Enquiry / feedback form with Turnstile, honeypot, rate limiting, moderation queue | C |
| 2.14 | Print stylesheets for tables, fixtures and scorecards; on‑page Print buttons | — |
| 2.15 | `.ics` downloads and subscribable calendar feeds | B |
| 2.16 | Text‑size control, theme toggle, high‑contrast mode | — |
| 2.17 | SEO: sitemap, `robots.txt`, Open Graph, structured data | — |
| 2.18 | **Usability test round 1** with the panel, on their own devices, unmoderated tasks |

**Milestone — beta launch at `beta.hertsttl.org.uk` (week 9).** The old site stays live and authoritative. Committee and panel use the beta in parallel and report through a single feedback link.

**Exit criteria:** every task on the old site is achievable on the beta; zero axe violations; Lighthouse mobile ≥ 90 on all four counts; panel completes all core tasks unaided.

---

## Phase 3 — Authentication and result entry (4 weeks)

**Goal:** captains file results from their phones. This is the phase that decides whether the project succeeds.

| # | Deliverable |
|---|---|
| 3.1 | Magic‑link authentication; TOTP two‑factor for elevated roles; a clear plain‑English sign‑in page |
| 3.2 | Account linking — every registered player matched to a login; a self‑service "I can't sign in" route |
| 3.3 | Contact directory behind login, replacing "LogIn to see" — driven by real consent flags |
| 3.4 | **Scorecard entry.** One rubber per screen on mobile, all‑at‑once on desktop. Large number steppers. Player pickers pre‑filtered to eligible players with the likely names first. Running totals shown live. Auto‑save every change |
| 3.5 | Draft and offline support — a card started in a hall with no signal completes and syncs later |
| 3.6 | Validation and eligibility warnings, phrased as guidance ("Sunil is registered with HRC C — that's fine, but it counts as playing up") rather than errors |
| 3.7 | Confirmation flow — opposing captain emailed a one‑click confirm/dispute link; escalation to the match secretary after 72 hours |
| 3.8 | Automatic recalculation of standings and averages, with on‑demand page revalidation |
| 3.9 | Postponement and rearrangement requests |
| 3.10 | "My team" personalised view and opt‑in fixture reminders |
| 3.11 | Captain's dashboard — outstanding cards, next fixture, roster |
| 3.12 | **Usability test round 2** — captains filing a real result on their own phones, timed against goal G6 (under 3 minutes) |

**Exit criteria:** three captains independently file a real result on a phone in under three minutes, with no assistance and no fallback to email.

---

## Phase 4 — Competitions and committee tooling (3 weeks)

| # | Deliverable |
|---|---|
| 4.1 | Closed Championships — event setup, online entry with partner selection, eligibility rules applied, entry lists, waitlists |
| 4.2 | Handicap Cup entry and the minimum‑matches eligibility rule |
| 4.3 | Cup draw tooling and bracket rendering |
| 4.4 | Handicap setting and publication |
| 4.5 | Committee content workflows in Directus, with a tailored, simplified admin layout — the committee should never see a field they don't need |
| 4.6 | CSV exports: entry lists, contact lists, results |
| 4.7 | Enquiry moderation queue with assignment |
| 4.8 | Season rollover action (FR‑38), **rehearsed on staging against real data** |
| 4.9 | Nightly integrity checks and the weekly outstanding‑cards chase |

**Exit criteria:** the match secretary runs a full simulated cup round and tournament entry cycle on staging without developer involvement.

---

## Phase 5 — Migration and cutover (2 weeks)

| # | Deliverable |
|---|---|
| 5.1 | ETL from the database export — idempotent, re‑runnable, driven by the schema mapping produced in Phase 0. HTML scraping is used only for anything the export turns out not to contain |
| 5.2 | **Hall of Fame 1970–present migrated** and verified line by line against the source page |
| 5.3 | Historic tables, averages, results and Rolls of Honour migrated as `is_historic` snapshots |
| 5.4 | **Reconciliation pass**: migrated tables, averages, fixtures and results compared against the Phase 0 scrape of the live site. Every discrepancy explained before cutover |
| 5.5 | Name reconciliation reviewed and signed off by the match secretary |
| 5.6 | Documents uploaded, categorised, superseded editions marked |
| 5.7 | 301 redirect map (§7 of the data model) implemented and tested against the full crawl list from this audit — all 90 URLs. Under "new look, same map", each redirect must land on a page carrying the same name and content as the one it replaces |
| 5.8 | DNS cutover with a low TTL set 48 hours ahead; HTTPS with HSTS; `www` and apex both resolving |
| 5.9 | Old site frozen read‑only at `legacy.hertsttl.org.uk` for one season as a safety net |
| 5.10 | Announcement: home‑page notice, newsletter, email to all captains, a note read at the AGM |
| 5.11 | Search Console verified; sitemap submitted; redirects monitored for 404s |

**Cutover timing.** Do **not** cut over mid‑season or in the week before a cup final. The two safe windows are late August (pre‑season) or the Christmas break. Recommend pre‑season.

**Rollback plan.** DNS reverts to the old host; the old site has never been deleted; the only data lost would be results entered in the new system during the window, which are exportable.

---

## Phase 6 — Aftercare (ongoing, first 8 weeks intensive)

| # | Deliverable |
|---|---|
| 6.1 | Two training sessions: one for the committee (Directus), one for captains (result entry). Recorded |
| 6.2 | A **printed one‑page guide** for captains — this audience will use paper, and pretending otherwise is a design failure |
| 6.3 | Written runbook: deploy, restore a backup, roll the season over, add a user, common fixes |
| 6.4 | Two committee members hold admin credentials and have both performed a restore |
| 6.5 | Monitoring: uptime, error tracking, weekly Lighthouse, monthly 404 report |
| 6.6 | A named point of contact and a stated response expectation for problems |
| 6.7 | Post‑launch review at 8 weeks against the §10 metrics; backlog re‑prioritised |

---

## Cross‑cutting: accessibility assurance

Not a phase — a gate on every phase.

| When | Check |
|---|---|
| Every pull request | axe‑core automated scan; Lighthouse budgets; typecheck and lint |
| Every feature | Keyboard‑only walkthrough; 200% zoom; 400% zoom reflow |
| Every phase end | Screen‑reader pass (NVDA on Windows, VoiceOver on iOS) |
| Phases 2 and 3 | Usability testing with real users aged 60+ |
| Before cutover | External WCAG 2.2 AA audit, or a documented self‑assessment if budget doesn't allow |
| After cutover | Published accessibility statement with a named contact and a feedback route |

Automated tools catch perhaps 30% of accessibility problems. The panel of six real users is the substantive control, not the CI job.

---

## Sequencing rationale

**Why the public read‑only site comes before result entry.** It is the larger share of traffic, it proves the design system with real users, and it can run alongside the old site with no risk. If the project stalls after phase 2, the league still has a modern, accessible, mobile‑friendly site — the failure mode is a partial win rather than nothing.

**Why migration comes last.** ETL against a schema that is still changing is wasted work. Once phases 1–4 have exercised the model against real use, the shape is stable.

**Why authentication is not in phase 1.** Nothing public needs it, and building it early invites gold‑plating. It arrives immediately before the first feature that requires it.

**Why the beta runs in parallel rather than replacing.** The audience is risk‑averse and the site is operationally load‑bearing during a season. A parallel beta lets people try the new site with no consequence if they dislike it — and their reactions are the most valuable design input available.

---

## A leaner alternative — *not being taken*

**Superseded by the 26 Aug 2026 decision to run all phases.** Recorded here in case the programme has to be cut back mid‑flight; if that happens, this is the shape to cut to.

If 18 weeks or the budget were not available, this cut would still leave the league materially better off:

**Minimum viable modernisation (~8 weeks)**
- Phase 0, Phase 1
- Phase 2 items 2.1–2.9, 2.11, 2.14, 2.16
- Phase 5 items 5.6, 5.7 (redirects and HTTPS)
- Keep result entry on the existing ASP system for one more season, reading its database from Directus or syncing nightly

This fixes every critical and high finding — HTTPS, mobile, hover navigation, contrast, type size — and defers the interactive work. The risk is running two systems for a season; the mitigation is that the old system keeps working exactly as it does now.

**What should not be cut, at any budget:** HTTPS, the removal of password‑free admin, the privacy notice, and the Hall of Fame migration. The first three are liabilities; the fourth is irreplaceable if the file is ever lost.
