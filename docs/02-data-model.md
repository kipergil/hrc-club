# Data Model — Directus

Companion to [01-prd.md](01-prd.md). Defines the collections, relationships, permissions and automation that back the rebuilt site.

**Database:** PostgreSQL 16. **Platform:** Directus 11+.

---

## 1. Design principles

1. **Season is a first‑class dimension.** Almost everything is scoped to a season. This is what kills the current site's hand‑copied `Tables2024.htm` / `Tables2025.htm` pattern (finding C7) — one query with a season filter replaces a new file every year.
2. **People are separate from their registrations.** A person exists once; they register with a team each season. This makes career records, the Hall of Fame and "played up/down" tracking possible, and gives a single place to action a GDPR erasure request.
3. **Results are stored at rubber level, not as a summary.** The league already collects this on the scorecard. Storing it means averages, head‑to‑heads and player profiles are derived rather than maintained.
4. **Standings and averages are derived, then materialised.** Computed by a Flow on confirmation and written to cache collections, so public pages read one indexed table instead of aggregating on every request.
5. **PII is isolated to two collections** (`people`, `tournament_entries`) with field‑level permissions, so "the public API cannot return a phone number" is enforced by the platform, not by frontend discipline (fixes A3).
6. **Reference data is soft, not enum‑hardcoded.** Competitions, divisions and award types are rows, because leagues rename and restructure them.

---

## 2. Collections

Legend: `PK` primary key · `FK` foreign key · `M2O` many‑to‑one · `O2M` one‑to‑many · `M2M` many‑to‑many · 🔒 restricted field

### 2.1 Core structure

#### `seasons`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | string | "2026‑27" |
| `slug` | string | "2026-27" |
| `starts_on` / `ends_on` | date | |
| `is_current` | boolean | Exactly one true; enforced by a Flow |
| `status` | enum | `upcoming` · `active` · `archived` |
| `agm_date`, `agm_venue` | date, string | Drives the home‑page AGM notice |

#### `venues`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name` | string | "Bushby Hall" |
| `address_line_1`, `address_line_2`, `town`, `postcode` | string | |
| `latitude`, `longitude` | decimal | For maps and "clubs near me" |
| `directions` | text | Plain‑English travel notes |
| `parking_notes` | text | |
| `step_free_access` | boolean | |
| `accessible_toilet` | boolean | |
| `hearing_loop` | boolean | |
| `access_notes` | text | Anything else an older or disabled player needs to know |
| `photo` | file | Helps first‑time visitors find the door |

Separate from `clubs` because two clubs can share a hall and a club can move.

#### `clubs`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `name`, `slug` | string | "Water Lane" / "water-lane" — a canonical slug fixes the duplicate‑URL bug B6 |
| `short_name` | string | |
| `primary_venue` | M2O → `venues` | |
| `founded_year` | integer | |
| `about` | rich text | |
| `logo` | file | |
| `website_url` | string | |
| `public_contact_email` | string | A role address, not a personal one |
| `is_active` | boolean | |

#### `divisions`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `name`, `slug` | string | "Premier Division" |
| `sort_order` | integer | |
| `rubbers_per_match` | integer | 9 (6 singles + 3 doubles) |
| `sets_per_rubber` | integer | 5 (best of) |
| `points_per_set` | integer | 11, win by 2 |
| `points_system` | json | How league points are awarded per rubber/match |
| `tiebreak_rules` | json | Ordered list, e.g. `["matches_won","head_to_head_games"]` — Handbook rule 20 |
| `tiebreak_explainer` | rich text | The plain‑English version shown on the tables page |

#### `teams`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `club` | M2O → `clubs` | |
| `suffix` | string | "A", "B", or empty for single‑team clubs |
| `name` | string | Computed: "Water Lane A" |
| `slug` | string | |
| `division` | M2O → `divisions` | |
| `home_night` | enum | Monday…Sunday |
| `home_venue` | M2O → `venues` | Overrides the club's primary venue when needed |
| `captain` | M2O → `people` | |
| `is_active` | boolean | |

### 2.2 People

#### `people` 🔒
| Field | Type | Public | Notes |
|---|---|---|---|
| `id` | uuid PK | ✓ | |
| `first_name`, `last_name` | string | ✓ | |
| `display_name` | string | ✓ | Handles duplicates: "J. Swain (WL)" |
| `slug` | string | ✓ | For profile URLs |
| `email` 🔒 | string | ✗ | |
| `phone` 🔒 | string | ✗ | |
| `date_of_birth` 🔒 | date | ✗ | Drives Vets / Super Vets / Junior eligibility |
| `is_junior` | boolean | ✓ | Derived; public only as a flag, never a date |
| `gender` 🔒 | string | ✗ | Ladies' events eligibility only |
| `tte_membership_id` 🔒 | string | ✗ | |
| `tte_membership_verified` | boolean | ✓ | |
| `photo` | file | ✓ | Optional, consent‑gated |
| `consent_contact_visible_to_members` | boolean | — | Replaces the fake "LogIn to see" gate with real consent |
| `consent_newsletter` | boolean | — | |
| `parental_consent_on_file` | boolean | — | Required where `is_junior` |
| `directus_user` | M2O → `directus_users` | — | Links a person to a login |
| `notes` 🔒 | text | ✗ | Committee only |
| `deceased` | boolean | — | So the Hall of Fame handles memorials with care |

> Public API responses expose only the ✓ fields. This is set as a Directus **field‑level permission on the Public role**, so the restricted fields are absent from the payload entirely.

#### `registrations`
A person's membership of a team for a season. The `played_up_from` field captures what the current site shows only as italics (finding B4).

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `person` | M2O → `people` | |
| `team` | M2O → `teams` | The team they are registered with |
| `registered_on` | date | |
| `is_active` | boolean | |
| `handicap` | integer | Current season handicap (also historised in `handicaps`) |
| `cup_locked_to_team` | M2O → `teams` | Enforces "you may only play for ONE team per cup" |

#### `committee_roles`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `role` | string | "Chairperson", "Treasurer", "Match Secretary" |
| `person` | M2O → `people` | |
| `public_email` | string | Role alias — `matchsec@hertsttl.org.uk`, never a personal address |
| `sort_order` | integer | |
| `bio` | text | |

### 2.3 Competition and fixtures

#### `competitions`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `name`, `slug` | string | "Creasey Cup", "Hertford Builders Trophy" |
| `type` | enum | `league` · `knockout` · `handicap_knockout` · `closed_tournament` |
| `eligibility_division` | M2O → `divisions` | Nullable — Creasey Cup is Premier only |
| `format_rules` | rich text | Shown on the competition page |
| `scoring_rules` | json | Handicap cup: best of 3, first to 21, no win‑by‑2 |
| `min_league_matches_to_enter` | integer | Handicap Cup requires 2 |
| `final_week_commencing` | date | |
| `final_venue` | M2O → `venues` | Nullable while TBA — and rendered as "To be confirmed", never as 1899 (fixes C2) |
| `entries_close_on` | date | Nullable |

#### `fixtures`
One row per match, league or cup.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `competition` | M2O → `competitions` | |
| `division` | M2O → `divisions` | Null for cups |
| `round` | string | "Preliminary", "Semi‑final", "Final" — null for league |
| `week_commencing` | date | The league schedules by week, not day — model it as it works |
| `scheduled_at` | timestamp | Actual date/time once known |
| `home_team`, `away_team` | M2O → `teams` | |
| `venue` | M2O → `venues` | Defaults from the home team |
| `is_reverse_fixture` | boolean | Replaces "results in italics are reversed fixtures" |
| `status` | enum | `scheduled` · `played` · `postponed` · `rearranged` · `void` · `walkover` · `no_match` |
| `rescheduled_from` | M2O → `fixtures` | |
| `home_score`, `away_score` | integer | Rubbers won; derived from the card |
| `home_points`, `away_points` | integer | League points awarded |
| `notes` | text | |

#### `match_cards`
The submitted scorecard, with a lifecycle.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `fixture` | M2O → `fixtures` | One‑to‑one in practice |
| `status` | enum | `draft` · `submitted` · `confirmed` · `disputed` · `amended` |
| `submitted_by` | M2O → `directus_users` | |
| `submitted_at` | timestamp | |
| `confirmed_by`, `confirmed_at` | | Opposing captain or match secretary |
| `dispute_reason` | text | |
| `home_lineup`, `away_lineup` | O2M → `card_players` | A/B/C and X/Y/Z |
| `rubbers` | O2M → `rubbers` | |
| `notes` | text | |
| `scan` | file | Optional photo of the paper card |

#### `card_players`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `match_card` | M2O → `match_cards` | |
| `side` | enum | `home` · `away` |
| `slot` | string | "A", "B", "C" / "X", "Y", "Z" |
| `person` | M2O → `people` | |
| `registration` | M2O → `registrations` | Records which team they were registered with **at the time** |
| `played_up` | boolean | Derived — registered below the division played in |
| `eligibility_warning` | string | Non‑blocking flag surfaced to the match secretary (FR‑23) |

#### `rubbers`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `match_card` | M2O → `match_cards` | |
| `order` | integer | 1–9 |
| `is_doubles` | boolean | |
| `home_players`, `away_players` | M2M → `card_players` | One each for singles, two for doubles |
| `set_scores` | json | `[[11,7],[9,11],[11,5],[11,8]]` — validated against the competition's scoring rules |
| `home_sets`, `away_sets` | integer | Derived |
| `winner` | enum | `home` · `away` |
| `handicap_home`, `handicap_away` | integer | Handicap competitions only |

#### `handicaps`
Historised so past seasons stay accurate.

| Field | Type |
|---|---|
| `id` | uuid PK |
| `season` | M2O → `seasons` |
| `person` | M2O → `people` |
| `value` | integer |
| `set_by` | M2O → `directus_users` |
| `effective_from` | date |
| `published` | boolean |

### 2.4 Derived / materialised

Written by Flows, never edited by hand. Public API read‑only.

#### `standings`
| Field | Type |
|---|---|
| `id` | uuid PK |
| `season`, `division`, `team` | M2O |
| `played`, `won`, `drawn`, `lost` | integer |
| `games_for`, `games_against`, `games_diff` | integer |
| `points` | integer |
| `position` | integer |
| `tiebreak_applied` | boolean |
| `tiebreak_explanation` | text — the plain‑English sentence, generated once and stored, rather than emitted 24 times into the page (fixes C4) |
| `computed_at` | timestamp |

#### `player_averages`
| Field | Type |
|---|---|
| `id` | uuid PK |
| `season`, `division`, `person`, `team` | M2O |
| `played`, `won`, `lost` | integer |
| `percentage` | decimal |
| `matches_available`, `participation_percentage` | integer, decimal |
| `is_eligible` | boolean — the ≥50% participation rule, shown as a badge (FR‑4) |
| `rank_in_division` | integer |
| `computed_at` | timestamp |

#### `head_to_head` *(optional, phase 3+)*
Cached pairwise records for player profile pages.

### 2.5 Honours and history

#### `honours`
Covers both the Roll of Honour and the Hall of Fame back to 1970. Text fields alongside the relations because pre‑migration winners ("County Hall TTC", "Hertford I") may no longer exist as clubs.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season_label` | string | "1970", "2025‑26" — historic records predate the `seasons` table |
| `season` | M2O → `seasons` | Nullable |
| `competition_name` | string | Denormalised for historic competitions |
| `competition` | M2O → `competitions` | Nullable |
| `award_type` | enum | `division_title` · `cup` · `individual_trophy` · `special_award` |
| `winner_team` | M2O → `teams` | Nullable |
| `winner_person` | M2O → `people` | Nullable |
| `winner_text` | string | Fallback for historic entries |
| `runner_up_team` / `runner_up_person` / `runner_up_text` | | |
| `notes` | text | "No Competition" (2021) |
| `sort_year` | integer | For the timeline view |

### 2.6 Tournaments (Closed Championships, Handicap Cup)

#### `tournaments`
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `season` | M2O → `seasons` | |
| `name` | string | "2026‑27 Closed Championships" |
| `is_running_this_season` | boolean | An explicit flag, so "not running this year" renders as a clear message instead of a broken sentence (fixes C2) |
| `cancellation_reason` | text | |
| `venue` | M2O → `venues` | |
| `dates` | json | Multiple evenings |
| `entries_open_on`, `entries_close_on` | date | |
| `entry_fee_note` | text | |
| `entry_instructions` | rich text | |

#### `tournament_events`
The 13 events on the current site.

| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `tournament` | M2O → `tournaments` | |
| `name` | string | "Open Singles", "Ladies Doubles", "Super Vets Singles", "Intermediate Cup" |
| `slug` | string | |
| `is_doubles` | boolean | |
| `eligibility` | json | `{min_age, max_age, gender, max_division, min_league_matches}` |
| `eligibility_plain_english` | string | Shown to the entrant, e.g. "For players aged 60 and over" |
| `max_entries` | integer | |
| `sort_order` | integer | |
| `scheduled_at` | timestamp | |

#### `tournament_entries` 🔒
| Field | Type | Notes |
|---|---|---|
| `id` | uuid PK | |
| `event` | M2O → `tournament_events` | |
| `person` | M2O → `people` | |
| `partner` | M2O → `people` | Doubles; nullable while unpaired |
| `entered_at` | timestamp | |
| `status` | enum | `pending` · `confirmed` · `withdrawn` · `waitlist` |
| `fee_paid` | boolean | |
| `seed` | integer | |
| `notes` | text | |

Public sees an entry **list** (name + club + event) only where the entrant consented; the entry record itself is restricted.

### 2.7 Content

#### `pages`
| Field | Type |
|---|---|
| `id` | uuid PK · `slug` · `title` · `subtitle` · `body` (rich text) · `hero_image` · `seo_title` · `seo_description` · `og_image` · `status` (draft/published) · `sort_order` · `show_in_nav` · `nav_group` |

#### `news`
| Field | Type | Notes |
|---|---|---|
| `id` · `title` · `slug` · `summary` · `body` · `image` · `published_at` · `expires_at` · `is_pinned` · `category` (enum: `news` · `notice` · `urgent`) · `season` · `author` | | `expires_at` prevents the stale‑Christmas problem (C1) — time‑bound content removes itself |

#### `newsletters`
| Field | Type |
|---|---|
| `id` · `season` · `number` · `issue_date` · `title` · `body` (rich text) · `pdf` (file) · `status` |

#### `documents`
| Field | Type | Notes |
|---|---|---|
| `id` · `title` · `description` · `category` (enum: `constitution` · `handbook` · `form` · `minutes` · `scorecard` · `other`) · `season` · `file` · `superseded_by` · `published` | | `superseded_by` surfaces "this is the 2019‑20 form, the current one is here" instead of silently serving stale forms (fixes C5) |

#### `sponsors`
| Field | Type |
|---|---|
| `id` · `name` · `url` · `logo` · `blurb` · `tier` (enum) · `is_active` · `display_from` · `display_until` · `sort_order` |

#### `enquiries` 🔒
| Field | Type | Notes |
|---|---|---|
| `id` · `type` (enum: `join` · `feedback` · `general`) · `topic` · `name` · `email` · `phone` · `message` · `is_league_player` · `nearest_town` · `submitted_at` · `ip_hash` · `spam_score` · `status` (enum: `new` · `in_progress` · `responded` · `spam`) · `assigned_to` · `internal_notes` | | Never publicly readable. Turnstile token verified server‑side before insert |

#### `settings` (singleton)
| Field | Type |
|---|---|
| `current_season` · `site_announcement` (rich text) · `announcement_expires_at` · `contact_email` · `webmaster_email` · `social_links` · `maintenance_mode` · `google_maps_key` |

---

## 3. Roles and permissions

| Role | Read | Write |
|---|---|---|
| **Public** (unauthenticated) | All published content; standings, averages, fixtures, results, honours, clubs, teams, venues, non‑restricted `people` fields | `enquiries` (create only, via a validated server endpoint) |
| **Player** (authenticated) | Public, plus captain/club contact details where the person consented; own `people` record | Own `people` record; `tournament_entries` for self; own preferences |
| **Captain** | Player, plus full roster and contact details for own club | Create/update `match_cards` for own team's fixtures while `draft`/`submitted`; confirm or dispute the opponent's card; request postponement |
| **Match Secretary** | Everything except committee‑private notes | Fixtures, registrations, handicaps, all match cards at any status, cup draws, tournament management |
| **Committee** | Everything | Content, documents, news, sponsors, enquiry moderation, honours |
| **Administrator** | Everything | Schema, users, roles, settings |

**Field‑level rules that matter most**

- Public role: `people.email`, `people.phone`, `people.date_of_birth`, `people.gender`, `people.tte_membership_id`, `people.notes` — **denied**, so the API never emits them.
- Public role: `enquiries`, `tournament_entries`, `directus_users` — **no read at all**.
- Captain role: `match_cards` write is filtered — `fixture.home_team.captain = $CURRENT_USER` OR `fixture.away_team.captain = $CURRENT_USER`, AND `status IN (draft, submitted)`.
- Junior records: contact fields readable only by Match Secretary, Committee and the captain of the junior's own club.

---

## 4. Flows (automation)

| Flow | Trigger | Does |
|---|---|---|
| **Recalculate standings** | `match_cards.status` → `confirmed` or `amended` | Recompute `standings` for the affected division, apply tie‑break rules in order, generate and store the plain‑English tie‑break sentence |
| **Recalculate averages** | Same | Recompute `player_averages` for affected people; recompute participation and eligibility |
| **Revalidate site** | After the two above, and on publish of any content collection | POST the affected paths to the frontend's revalidation webhook (Tier B, §5 of the PRD) |
| **Notify opposing captain** | `match_cards.status` → `submitted` | Email with a one‑click confirm/dispute link |
| **Notify match secretary** | Card disputed, or unconfirmed after 72 hours | Email |
| **Chase outstanding cards** | Weekly cron | Email captains whose fixtures are past `week_commencing` with no card |
| **Fixture reminders** | Daily cron | Email opted‑in players the day before their match |
| **Validate card on submit** | Before insert/update | Set scores match the competition rules; nine rubbers present; every player has a valid registration; cup single‑team rule; handicap‑cup minimum‑matches rule. Warnings, not hard blocks, where the committee may need to override |
| **Enforce single current season** | `seasons.is_current` changes | Unset the others |
| **Season rollover** (FR‑38) | Manual, operated by the match secretary | Archive current season, create next, copy clubs/venues/divisions forward, open registration |
| **Spam screen** | New `enquiries` row | Verify the Turnstile token, score the content, auto‑file obvious spam, notify the committee otherwise |
| **Retention purge** | Monthly cron | Null contact fields on people with no registration for N seasons (§8 of the PRD) |
| **Nightly integrity check** | Cron | Fixtures with no card past their date; standings that disagree with a recomputation; orphaned registrations. Report by email |

---

## 5. Public API surface consumed by the frontend

Read paths (all cached at the edge):

```
GET /items/standings?filter[season][slug]=2026-27&filter[division][slug]=premier&sort=position
GET /items/fixtures?filter[season][slug]=2026-27&filter[week_commencing][_gte]=$NOW&sort=week_commencing&limit=20
GET /items/fixtures?filter[_or][0][home_team][slug]=water-lane-a&filter[_or][1][away_team][slug]=water-lane-a
GET /items/match_cards?filter[fixture][id]=…&fields=*,rubbers.*,home_lineup.person.display_name
GET /items/player_averages?filter[season][slug]=2026-27&filter[is_eligible]=true&sort=-percentage
GET /items/honours?filter[competition_name]=Creasey Cup&sort=sort_year
GET /items/clubs?fields=*,primary_venue.*,teams.*
```

Write paths (authenticated, POST/PATCH only):

```
POST  /items/match_cards
PATCH /items/match_cards/:id            # save draft, submit, confirm, dispute
POST  /items/tournament_entries
PATCH /items/people/:id                 # own record only
POST  /api/enquiry                      # Nuxt server route → Turnstile verify → Directus
```

---

## 6. Migration mapping

| Source | Target | Method |
|---|---|---|
| Existing ASP database (if available) | All operational collections | Direct SQL export → transform → Directus import. **Preferred route** |
| `Clubz.asp?Club=*` | `clubs`, `venues`, `teams`, `registrations` | Scrape; deduplicate the space/no‑space URL variants (B6) |
| `Calendar{0,1,2}.htm`, `Matches*.htm` | `fixtures` | Scrape; parse week‑commencing grid |
| `MatchHistory.asp?Team=*` | `fixtures`, `match_cards` | Scrape results and scorecards |
| `Tables*.htm`, `Averages*.htm`, `Handicaps*.htm` | `standings`, `player_averages`, `handicaps` (historic seasons) | Scrape; store as computed snapshots, flagged `is_historic` so Flows don't recompute them |
| `HallOfFame2025.htm` | `honours` | Scrape the decade‑column grid; ~56 years × ~8 competitions. **Highest‑value migration** |
| `RollOfHonour*.htm` | `honours` | Scrape |
| PDFs and DOCs | `documents` | Upload, categorise, mark superseded editions |
| `CommitteeMinutes.htm`, `Minutes4Apr17.htm` | `documents` (category `minutes`) | Convert to PDF, retain |
| `Links.htm` | `sponsors` | Manual |
| Newsletter archive | `newsletters` | Scrape / manual |

**Normalisation during ETL**

- Fix WINDOWS‑1252 mojibake — "Jo� Swain" → "Jo Swain" (C3). Every repaired string flagged for human review.
- Reconcile player names across seasons into single `people` records; the match secretary reviews ambiguous matches.
- Canonicalise club and team names and generate stable slugs.
- Resolve `is_reverse_fixture` from the italic markup in the source.
- Reject and report anything that fails validation rather than importing it silently.

---

## 7. URL mapping — old to new

Every existing URL gets a 301. Bookmarks and inbound links must keep working (goal G10).

| Old | New |
|---|---|
| `/Home.htm`, `/default.htm`, `/index.htm` | `/` |
| `/Tables.asp` | `/tables` |
| `/Tables2025.htm` | `/seasons/2025-26/tables` |
| `/Calendarz.asp?Div=0`, `/Calendar0.htm` | `/fixtures/premier` |
| `/MatchHistory.asp?Team=HRC A` | `/teams/hrc-a` |
| `/Clubz.asp?Club=HRC`, `?Club=WaterLane` etc. | `/clubs/{slug}` |
| `/Averages.asp` | `/averages` |
| `/Averages2025.htm` | `/seasons/2025-26/averages` |
| `/Handicaps.asp` | `/handicaps` |
| `/CupNews.asp` | `/cups` |
| `/Newz.asp?NlNo=n` | `/newsletters/{n}` |
| `/Notices.asp` | `/news` |
| `/RollofHonour2025-26.htm` | `/honours/2025-26` |
| `/HallOfFame2025.htm` | `/honours` |
| `/ClosedInvite.asp`, `/ClosedList.asp` | `/tournaments/closed` |
| `/HCapApp1.asp` *(currently 404)* | `/tournaments/handicap-cup` |
| `/Feedback.asp` | `/contact` |
| `/LogMeIn.asp`, `/SignIn.asp`, `/Admin.asp` | `/sign-in` |
| `/Links.htm` | `/links` |
| `/CommitteeMinutes.htm` | `/documents?category=minutes` |
| `*.pdf`, `*.doc` | `/documents/{slug}` (files re‑served from Directus, with the original paths redirected) |
