# HRC Club Website — Scope and Architecture

**Status:** proposed
**Written:** 28 August 2026
**Applies to:** `kipergil/hrc-club`

---

## 1. What this is

A website for **HRC**, one of the ten clubs in the Hertford & District Table Tennis League. HRC fields four teams — HRC A and HRC B in the Premier Division, HRC C in Division One and HRC D in Division Two — and plays at Bushby Hall, Wormley.

**It carries the whole league, not only HRC.** All ten clubs are held as data, with their venues, teams and squads: 10 clubs, 26 teams, 165 squad places. `is_home_club` marks HRC, and that flag is what "our teams" and "our players" filter on. The reason is practical rather than ambitious — an opponent that is only a name in a fixture list cannot answer "where are we playing on Thursday, and is there parking", which is the question a player actually has on a match night.

This is a *club* site, not the league site. The distinction sets the whole scope:

| | League site (`hertsttl.org.uk`) | Club site (this project) |
|---|---|---|
| Owns | Fixtures, results, tables, averages, handicaps, registrations | Nothing competitive |
| Audience | Every player in the league | People considering joining HRC, and HRC's own members |
| Core job | Run the competition | Answer "when can I come and play?", then keep members informed |
| Result entry | Yes — captains enter cards | No. Captains enter results on the league site, as they always have |

The club site **reads** competitive data and **owns** everything else. It never becomes a second place to enter a result, because two places to enter a result means two answers to "what was the score".

## 2. What it is for

In rough order of how often the pages will be used:

1. **When and where can I play?** The weekly timetable, the venue, what it costs, who to ask. This is the single most-used piece of information on any club website and most club websites bury it.
2. **How did we get on?** Fixtures, results and tables for all four teams, plus match reports.
3. **How do I join?** Membership options, fees, and a form that reaches a human.
4. **Club life.** News, events, the AGM, presentation night, photos.
5. **The record.** Honours, past squads, who has played for the club.
6. **Club business.** Constitution, minutes, policies, the committee.

## 3. Technology stack

**The stack is `kipergil/pintogather`'s, not the league PRD's.** This is a deliberate divergence and worth stating plainly, because the two disagree:

- `docs/01-prd.md` §9 specifies **Nuxt 4 / Vue 3** for the league rebuild.
- `pintogather` is **React 18 + Vite + Express + Directus + Clerk**, deployed on Vercel.

This project follows pintogather. The reasoning is portfolio-level rather than technical: these projects share one Directus instance and one maintainer, and a second framework doubles the surface that maintainer has to keep in their head. The properties the league PRD actually argues for in §5 and §7.6 — content readable without JavaScript, ~90% of views served from a CDN with no database on the request path, regeneration on an event rather than a timer — are all achievable in this stack. §4 sets out exactly how, since they do not come for free the way Nitro route rules give them to Nuxt.

If the league rebuild lands on Nuxt as planned, the two sites will differ in framework but share a Directus instance, a data-modelling convention, and an accessibility baseline. That is a reasonable seam.

| Layer | Choice | Notes |
|---|---|---|
| Frontend | React 18, TypeScript, **Vite 5** | Same as pintogather |
| Routing | **wouter** | Small; the site has ~25 routes |
| Server state | **TanStack Query** | Cache, revalidation, offline-friendly |
| Styling | **Tailwind CSS** + shadcn/ui (Radix primitives) | Radix gives the focus management and ARIA that §7.3 of the league PRD demands |
| Forms | react-hook-form + **Zod** | Zod schemas shared client/server from `shared/` |
| Backend-for-frontend | **Express 4** | One process, two entrypoints: `server/index.ts` (long-running) and `api/index.ts` (Vercel function) |
| Data | **Directus 11** on the existing shared instance | See §5 |
| Auth | **Clerk** | Members area only. The public site needs no login |
| Tests | **Vitest** + supertest, Testing Library | |
| CI | GitHub Actions — typecheck, test, build | |
| Hosting | **Vercel** | |

### What is deliberately not in the stack

- **No Stripe.** Membership fees are collected at the hall, as they are now. A payment integration is a data-protection and reconciliation burden a volunteer committee should take on only if it asks to.
- **No mobile app.** pintogather has one; a club of this size does not need one. The site is a PWA instead.
- **No Google Maps.** A static map image and a link to the venue's map page costs nothing, needs no API key, and loads on a slow phone.

## 4. Rendering architecture — static, dynamic and interactive

The league PRD's three-tier analysis carries over directly. What changes is the mechanism, because Vite has no equivalent of Nitro's `prerender`/`isr` route rules.

### Tier A — Static, built at deploy time (~45% of routes)

Content that changes a few times a season. A **prerender step in the build** walks the Tier A route list, fetches from Directus once per route, renders the React tree with `renderToString`, and writes real HTML to `dist/public/<route>/index.html`. Vercel serves those as static files.

This gives the property §7.6 of the league PRD asks for and an SPA cannot: the page is fully readable with JavaScript disabled or failed. The client bundle hydrates on top when it loads.

**Rebuild trigger:** a Directus Flow on publish calls a **Vercel Deploy Hook**. Editing a page in the admin panel puts it live in about a minute, with no human running a deploy.

### Tier B — Dynamic data, statically cached, regenerated on change (~40%)

Fixtures, results, tables, averages, news. Genuinely dynamic, but changing *on an event* — a result being confirmed — not continuously. Each Tier B route gets **both** paths:

1. **Prerendered at build**, exactly like Tier A. A visitor with no JavaScript, or on a phone that gives up on the bundle, still gets the fixtures.
2. **Revalidated after hydration** by TanStack Query against `/api/*`. The BFF sets `Cache-Control: public, s-maxage=600, stale-while-revalidate=3600`, so Vercel's CDN absorbs the match-night burst — one origin request per path per ten minutes, and a stale-but-instant response while that one refreshes.

A Directus Flow fires the same Deploy Hook when a fixture, standing or player-stat row changes, so the static copy catches up within a couple of minutes. Belt and braces: if the webhook fails, the ten-minute CDN TTL still refreshes the API path, and the next scheduled sync triggers a build anyway.

This is the honest translation of ISR into a stack that has no ISR. It is *not* as elegant as a Nitro route rule, and it costs one build per content change. At this content volume — a handful of results a week in season — that is perhaps 15 builds a week, well inside Vercel's free allowance.

### Tier C — Interactive, live, authenticated (~15%)

Rendered client-side, never cached, `Cache-Control: private, no-store`.

| Feature | Who | Notes |
|---|---|---|
| Contact / join enquiry form | Public | Rate limited, honeypot, written to `hrc_enquiries`, never readable back |
| Members area — my team, my fixtures, my average | Signed-in members | Clerk session, resolved to an `hrc_members` row by `clerk_user_id` |
| Members' contact directory | Signed-in members | The one place personal contact details are served, and only to members |
| All content editing | Committee | The Directus admin panel. No bespoke CMS is built |

### Summary

| Tier | Routes | Rendering | Database on the request path? |
|---|---|---|---|
| A | ~45% | Prerendered at build | Never |
| B | ~40% | Prerendered at build, revalidated through a CDN-cached API | Once per path per 10 minutes |
| C | ~15% | Client-side, authenticated | Every request |

## 5. Directus: a shared instance

The club's collections live on the **existing shared Directus instance** alongside BucketBoard, PinGather, LocalRater and the health network. Three conventions keep that safe, and all three are enforced in code rather than by discipline:

1. **Every collection is prefixed `hrc_`.** Generic names are already taken — `pages`, `tags`, `categories` and `comments` all belong to other projects.
2. **Every collection is filed under the `hrc_club` folder**, so the club's 24 collections read as one group rather than scattering through an alphabetical list of sixty.
3. **The tooling only ever creates.** `directus/src/schema/apply.ts` refuses to run if any definition strays outside the `hrc_` prefix, and it never updates or deletes a collection, field or relation it did not create.

Permissions follow the same instance convention: one policy and role named `HRC Club Service`, holding a narrowly-scoped static token for the Express server. It has no admin access, no panel login, and no reach beyond `hrc_*` and `directus_files`.

## 6. Where competitive data comes from

The club site does not compute standings; it mirrors them. Today the league runs on Classic ASP at `hertsttl.org.uk` with no API. The league rebuild (`docs/03-implementation-plan.md`) will put it on Directus with one, but that is ~18 weeks away and this site should not wait.

So the sync is written behind an interface with two implementations:

```
LeagueAdapter
  ├─ ScrapeAdapter   — parses the existing ASP pages for HRC's teams
  └─ ApiAdapter      — reads the league's Directus API, once it exists
```

Both produce the same normalised rows and upsert into `hrc_fixtures`, `hrc_standings` and `hrc_player_stats`, matching on `league_fixture_ref` so a re-run updates rather than duplicates. The sync writes only the columns it owns — a club-written match report on a fixture survives every future sync untouched.

Behind both sits the option that always works: **manual entry in the Directus admin panel**. The site is fully functional with the sync switched off, which is what makes it safe to launch before the scraper is reliable.

## 7. Accessibility baseline

The league PRD's §7 is written for an audience of mostly older adults. HRC's members are the same people. Its requirements are adopted here without dilution, and the ones that bind this codebase are:

- 20px base type in `rem`; nothing below 16px anywhere.
- Body text contrast ≥ 7:1; colour never the only signal — win/loss, home/away and cup weeks all carry a text label.
- No hover-dependent behaviour. 48×48px touch targets. 3px focus rings, never removed.
- Tables reflow to cards below 640px rather than scrolling sideways.
- Every Tier A and Tier B page readable with JavaScript off — which §4 is built to deliver.
- A text-size control (A / A+ / A++) in the header, persisted to `localStorage`.
- `prefers-reduced-motion` respected; no carousels, no modals unless unavoidable.

These are enforced in CI by axe-core tests over the prerendered HTML, not left to review.

## 8. Related documents

| Document | Covers |
|---|---|
| [01-content-inventory.md](01-content-inventory.md) | Every route, its tier, its data source and its rebuild trigger |
| [02-directus-data-model.md](02-directus-data-model.md) | The 24 collections, their fields and relations, and the permission model |
| [03-implementation-plan.md](03-implementation-plan.md) | Phases, deliverables and acceptance criteria |
| [../01-prd.md](../01-prd.md) | The league PRD this inherits its architecture and accessibility requirements from |
