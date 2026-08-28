# HRC Club Website — Content Inventory

Every route, what renders it, where its data comes from and what makes it rebuild.

Tiers are defined in [00-scope-and-architecture.md](00-scope-and-architecture.md) §4:

- **A** — prerendered at build, no database on the request path.
- **B** — prerendered at build *and* revalidated after hydration through a CDN-cached API.
- **C** — client-side, authenticated, never cached.

---

## 1. Static content (Tier A)

Content the committee edits a few times a season. Every one of these is a real page with real HTML at build time.

| Route | Page | Source | Rebuild trigger |
|---|---|---|---|
| `/about` | About the club | `hrc_pages` | On publish |
| `/about/history` | Our history | `hrc_pages` | On publish |
| `/play` | **When and where we play** | `hrc_sessions` + `hrc_venues` | Session or venue change |
| `/play/venue/:slug` | Venue detail — directions, parking, access | `hrc_venues` | Venue change |
| `/join` | Join us — fees and how | `hrc_membership_options` + `hrc_pages` | On publish |
| `/coaching` | Coaching | `hrc_pages` + `hrc_sessions` (type `coaching`) | On publish |
| `/juniors` | Juniors | `hrc_pages` + `hrc_sessions` (type `junior`) | On publish |
| `/committee` | Who's who | `hrc_committee_roles` → `hrc_members` | Role change |
| `/documents` | Club documents | `hrc_documents` | On upload |
| `/documents/:slug` | Document detail + download | `hrc_documents` | On upload |
| `/honours` | Roll of honour | `hrc_honours` | Season rollover |
| `/sponsors` | Sponsors | `hrc_sponsors` | On publish |
| `/links` | Useful links | `hrc_links` | On publish |
| `/help` | How do I…? | `hrc_faqs` | On publish |
| `/privacy` | Privacy notice | `hrc_pages` | On publish |
| `/accessibility` | Accessibility statement | `hrc_pages` | On publish |
| `/safeguarding` | Safeguarding | `hrc_pages` | On publish |

**`/play` is the most important page on the site.** It is Tier A because a timetable changes twice a year, and it must load instantly on a phone in a car park. It answers, above the fold and without a scroll: which nights, what times, which hall, what it costs, and whether a complete beginner can turn up.

### The five-entry menu

The league PRD caps the top navigation at five entries and forbids renaming pages people already know. The club equivalent:

| Menu | Contains |
|---|---|
| **Home** | `/` |
| **Play** | When and where we play · Join us · Coaching · Juniors · Where to find us |
| **Teams** | Our teams · Fixtures · Results · League tables · Averages · Players |
| **News** | News · Events · Photos |
| **About** | About the club · Our history · Who's who · Honours · Documents · Links · Sponsors · Contact |

Each destination keeps its plain name and gains a one-line subtitle beneath it — "League tables / Where our teams stand in their divisions" — as an addition, never a replacement. On mobile this is a large labelled **Menu** button, not a bare hamburger.

## 2. Dynamic content (Tier B)

| Route | Page | Source | Regenerated when | CDN TTL |
|---|---|---|---|---|
| `/` | Home | `hrc_site_settings`, `hrc_news`, `hrc_fixtures`, `hrc_events`, `hrc_sessions` | Any of the below | 10 min |
| `/news` | News and notices | `hrc_news` | On publish / expiry | 15 min |
| `/news/:slug` | Article | `hrc_news` | On publish | 15 min |
| `/events` | What's on | `hrc_events` | On publish | 15 min |
| `/events/:slug` | Event detail | `hrc_events` | On publish | 15 min |
| `/teams` | Our teams | `hrc_teams`, `hrc_squads` | Squad or team change | 60 min |
| `/teams/:slug` | Team page — squad, fixtures, results, position | `hrc_teams` + `hrc_squads` + `hrc_fixtures` + `hrc_standings` | Result confirmed | 10 min |
| `/fixtures` | Fixture calendar | `hrc_fixtures` (status `scheduled`) | Fixture synced or rescheduled | 10 min |
| `/results` | Results | `hrc_fixtures` (status `played`) | Result synced | 10 min |
| `/results/:id` | Match detail — card, rubbers, report | `hrc_fixtures` + `hrc_rubbers` + `hrc_news` | Result or report change | 60 min |
| `/tables` | League tables | `hrc_standings` | Standings synced | 10 min |
| `/averages` | Player averages | `hrc_player_stats` | Stats synced | 10 min |
| `/players` | Our players | `hrc_members` (`show_on_site`) | Member change | 60 min |
| `/players/:slug` | Player profile — record, teams, honours | `hrc_members` + `hrc_player_stats` + `hrc_honours` | Result synced | 60 min |
| `/gallery` | Photos | `hrc_gallery_albums` | On publish | 60 min |
| `/gallery/:slug` | Album | `hrc_gallery_albums` + `hrc_gallery_items` | On publish | 60 min |
| `/seasons/:label/*` | Any of the above, for a past season | Same, filtered by season | Season rollover | 24 h |

### Home page

Six large tappable cards, mirroring the league PRD's home-page rule, for the six things people actually come for:

**This week's matches · Latest results · League tables · When we play · News · Join us**

Above them, the announcement banner from `hrc_site_settings` when one is set and unexpired — the "tonight's session is cancelled, the hall is flooded" case, which is the single highest-value dynamic element on a club website and the one most club websites cannot do at all.

### Tables and mobile

Every table on the site — standings, averages, fixtures, results — reflows to stacked cards below 640px rather than scrolling sideways, and carries a one-sentence plain-English explanation above it. Standings highlight HRC's own rows with a text marker as well as a background, because colour is never the only signal.

## 3. Interactive content (Tier C)

| Route | Feature | Who | Notes |
|---|---|---|---|
| `/contact` | Enquiry form | Public | `POST /api/enquiries` → `hrc_enquiries`. Honeypot field, rate limit, no read-back |
| `/join` (form section) | Join enquiry | Public | Same endpoint, `enquiry_type: join` |
| `/members` | My club — my team, my next fixture, my record | Members | Clerk session → `hrc_members.clerk_user_id` |
| `/members/directory` | Members' contact directory | Members | The only route serving personal contact details |
| `/members/documents` | Members-only documents | Members | `hrc_documents` where `is_public` is false |
| *(Directus admin)* | All content editing | Committee | No bespoke admin UI is built |

### Why there is no result entry here

Captains enter results on the league site. Building a second entry point would create two sources of truth for the same score and put the club in the position of correcting the league's data. The club site's job is to *show* results well, including a match report the league site has no field for.

## 4. API surface

All under `/api`, served by the Express BFF using the `HRC Club Service` token. Cached responses carry `public, s-maxage=<ttl>, stale-while-revalidate=3600`; everything under `/api/members` carries `private, no-store`.

| Method | Path | Tier | Returns |
|---|---|---|---|
| GET | `/api/settings` | B | Club identity, current season, live announcement |
| GET | `/api/pages/:slug` | A | One published page |
| GET | `/api/sessions` | A | Active sessions with venue |
| GET | `/api/venues/:slug` | A | Venue with directions and access notes |
| GET | `/api/teams` | B | Teams for the current season with squad counts |
| GET | `/api/teams/:slug` | B | Team, squad, fixtures, results, table position |
| GET | `/api/fixtures?season=&team=&status=` | B | Fixtures, ordered by date |
| GET | `/api/results/:id` | B | Match with rubbers and report |
| GET | `/api/standings?season=&division=` | B | Full division tables |
| GET | `/api/averages?season=` | B | Player stats with eligibility flag |
| GET | `/api/news?category=&limit=` | B | Published articles |
| GET | `/api/news/:slug` | B | One article |
| GET | `/api/events` | B | Upcoming events |
| GET | `/api/players` / `/api/players/:slug` | B | Public member projection only |
| GET | `/api/gallery` / `/api/gallery/:slug` | B | Albums and items |
| GET | `/api/documents` | A | Public documents |
| GET | `/api/files/:id` | A | Proxied asset from `directus_files` |
| POST | `/api/enquiries` | C | Creates an enquiry. Rate limited, honeypot-checked |
| GET | `/api/members/me` | C | The signed-in member's own record |
| GET | `/api/members/directory` | C | Members' contact details |
| POST | `/api/revalidate` | — | Directus Flow webhook → Vercel Deploy Hook. Shared-secret header |
| POST | `/api/sync/league` | — | Scheduled league sync. Shared-secret header |

`/api/players` returns the same projection the service token is permitted to read — contact details are absent at the permission layer, not filtered in a route handler, so a handler that selects `*` still cannot leak them.

## 5. Content that must exist before launch

The site is only as good as what is in it. Minimum viable content, and who writes it:

| Content | Rows | Owner |
|---|---|---|
| Site settings | 1 | Webmaster |
| Current season | 1 | Webmaster |
| Home venue | 1, with directions, parking and access notes | Committee |
| Sessions | 3–6 | Committee |
| Teams | 3 (A, B, C) with captains | Match secretary |
| Squads | ~18–24 | Match secretary |
| Members | ~25, `show_on_site` off until each person opts in | Membership secretary |
| Membership options | 2–4 | Treasurer |
| Committee roles | 5–8, with role-based emails | Secretary |
| Pages | 8 (about, history, join, coaching, juniors, privacy, accessibility, safeguarding) | Committee |
| FAQs | 8–10 | Webmaster |
| Documents | Constitution, current minutes, membership form, safeguarding policy | Secretary |
| Honours | As far back as the records go | Anyone with the trophy cabinet and an afternoon |

Fixtures, standings and player stats come from the sync, or are entered by hand until it works.
