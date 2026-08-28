# HRC Club Website — Directus Data Model

**Status:** applied
**Instance:** the shared Directus 11 instance 
**Folder:** `hrc_club` — 24 collections, 334 fields
**Source of truth:** [`directus/src/schema/definitions.ts`](../../directus/src/schema/definitions.ts)

The field tables in §5 are generated from the live instance, so this document and the database cannot drift apart silently.

---

## 1. Design principles

**One prefix, one folder, create-only tooling.** This Directus instance is shared with BucketBoard, PinGather, LocalRater and the health network — 55 collections before this project added anything, including generic names like `pages`, `tags`, `categories` and `comments`. Every collection here is prefixed `hrc_` and filed under the `hrc_club` folder, and `apply.ts` refuses to run if a definition strays outside that prefix or points a relation at another project's table. The scripts only ever create; nothing they did not create is updated or deleted.

**`directus_users` is not extended.** pintogather bolts a dozen custom fields onto `directus_users` for its own identity model. This project deliberately does not, because that collection is shared with every other project on the instance and extending it would be exactly the sort of cross-project reach the prefix rule exists to prevent. Member identity lives on `hrc_members`, with `clerk_user_id` as the link to the external identity provider.

**Own what the club owns; mirror what the league owns.** Competitive data — fixtures, results, standings, averages — belongs to the league. Those collections are shaped for *upsert from a sync*, with a `league_*_ref` matching key and a `last_synced_at` stamp. Editorial data — reports, news, photos, honours — belongs to the club, and the sync never writes those columns, so a match report survives every future re-sync.

**Seasons scope almost everything.** A club site that cannot show you last season is a club site that throws away its own history. `hrc_seasons` is a real collection, `is_current` is the flag every default query reads, and teams, squads, fixtures, standings, stats and honours all hang off it. A team that changes division gets a new row per season rather than an edit, so last season's page stays correct.

**Privacy is enforced at the permission layer, never in a route handler.** `hrc_members.email` and `.phone` are absent from the service token's read projection (§4). A handler that selects `*` still cannot return them. And `show_on_site` defaults to *off*: nothing about a member is published until somebody ticks a box.

**Deletes are chosen, not defaulted.** `CASCADE` only where a child is meaningless without its parent — a rubber without its fixture, a photo without its album, a squad place without its team. `SET NULL` everywhere a record must outlive a reference: removing a member never erases the match history they appear in.

## 2. Collections at a glance

| Group | Collections |
|---|---|
| **Reference** | `hrc_seasons`, `hrc_venues`, `hrc_members` |
| **Teams** | `hrc_teams`, `hrc_squads` |
| **Mirrored from the league** | `hrc_fixtures`, `hrc_rubbers`, `hrc_standings`, `hrc_player_stats` |
| **The record** | `hrc_honours` |
| **Editorial** | `hrc_pages`, `hrc_news`, `hrc_events`, `hrc_sessions` |
| **Club business** | `hrc_membership_options`, `hrc_committee_roles`, `hrc_documents` |
| **Media** | `hrc_gallery_albums`, `hrc_gallery_items` |
| **Supporting** | `hrc_sponsors`, `hrc_links`, `hrc_faqs` |
| **Inbound** | `hrc_enquiries` |
| **Settings** | `hrc_site_settings` (singleton) |

## 3. How the pieces relate

```
hrc_seasons ─┬─< hrc_teams ─┬─< hrc_squads >── hrc_members
             │              ├─< hrc_fixtures ─< hrc_rubbers >── hrc_members
             │              └─< hrc_player_stats >── hrc_members
             ├─< hrc_standings
             └─< hrc_honours >── hrc_members / hrc_teams

hrc_venues ──< hrc_sessions / hrc_events / hrc_fixtures / hrc_teams
hrc_members ──< hrc_committee_roles / hrc_news (author) / hrc_enquiries (handled_by)
hrc_gallery_albums ──< hrc_gallery_items
hrc_news >── hrc_fixtures        (a match report links to its match)
```

The three joins worth explaining:

- **`hrc_squads`** is the team-membership join, carrying season, role and board order. A player who moves from the B to the A team gets a second row, not an edit — which is what keeps last season's squad list truthful.
- **`hrc_rubbers`** is optional detail. A fixture is complete and fully displayable with no rubber rows at all; the club can add card-level detail for matches it cares about without a partial-data problem everywhere else.
- **`hrc_news.fixture`** is what makes a match report a first-class thing: the report is a news article (so it appears in the news list, has a slug and an author), and the match page picks it up through the reverse `reports` list.

### Two deliberate redundancies

`hrc_site_settings.current_season` duplicates `hrc_seasons.is_current`, and `hrc_honours.season_label` duplicates what `hrc_honours.season` would give. Both are intentional:

- The settings field is the one an admin will actually find, and the flag is the one queries filter on. Keeping both costs one line in a season-rollover checklist and saves every editor from hunting through a collection list.
- `season_label` is a plain string because honours go back further than the site will ever hold `hrc_seasons` rows for. A 1974-75 divisional title should be recordable without inventing fifty empty season rows to hang it on.

## 4. Permissions

One policy and role, `HRC Club Service`, defined in [`directus/src/permissions/definitions.ts`](../../directus/src/permissions/definitions.ts) and applied by `npm run permissions:apply`. It carries the static token the Express server authenticates with. No admin access, no app access, no schema/role/policy access, and no reach outside `hrc_*` and `directus_files`.

| Collections | Permissions | Why |
|---|---|---|
| 19 editorial and reference collections | `read` | Authored in the admin panel; the app never writes them |
| `hrc_fixtures`, `hrc_standings`, `hrc_player_stats` | `read`, `create`, `update` | Written by the league sync. Never `delete` — a fixture that vanishes upstream is marked `void`, so a link to it never 404s |
| `hrc_members` | `read` (13 named fields), `update` (`clerk_user_id` only) | The projection excludes `email` and `phone`. The only writable column is the one the sign-in flow sets |
| `hrc_enquiries` | `create` only | A visitor can submit and can never read one back, so the form cannot be turned into a way of reading other people's messages |
| `directus_files` | `read` | Assets are proxied through the app, not linked directly. Uploads happen in the panel |

The members' contact directory (Tier C) is served by a separate, authenticated path — it does not widen this policy, because widening it would make contact details reachable by every public route as well.

Applying permissions creates a non-human service account and prints its token once. **Run it yourself** rather than having it run for you — the token is a credential and should not pass through a chat transcript or a CI log:

```bash
cd directus && cp .env.example .env   # fill in ADMIN_EMAIL / ADMIN_PASSWORD
npm install
npm run permissions:apply             # prints DIRECTUS_SERVICE_TOKEN once
```

## 5. Collections in full

Generated from the live instance. `**required**` marks a field the admin panel will not let you save empty.

<!-- BEGIN GENERATED SCHEMA -->

### `hrc_seasons`

A playing season, e.g. 2026-27. Almost everything else is scoped to one; `is_current` is what the site reads to decide which.

| Field | Type | Notes |
|---|---|---|
| `label` **required** | string | Season as players write it, e.g. "2026-27". |
| `slug` **required** | string | URL segment, e.g. "2026-27" in /seasons/2026-27. |
| `starts_on` | date | First day of the season. |
| `ends_on` | date | Last day of the season. |
| `is_current` | boolean | Exactly one season should have this set. The home page, fixtures, tables and averages all read it. Defaults to `false`. |
| `league_season_ref` | string | Identifier for the same season in the league's own system, for the fixture/result sync. |
| `teams` | o2m → `hrc_teams` | Reverse list |
| `squad_places` | o2m → `hrc_squads` | Reverse list |
| `fixtures` | o2m → `hrc_fixtures` | Reverse list |
| `standings` | o2m → `hrc_standings` | Reverse list |
| `player_stats` | o2m → `hrc_player_stats` | Reverse list |
| `honours` | o2m → `hrc_honours` | Reverse list |

### `hrc_venues`

Halls the club plays in — its own home venue and any away venue worth giving directions to.

| Field | Type | Notes |
|---|---|---|
| `name` **required** | string | e.g. "Hertford Rugby Club, main hall". |
| `slug` **required** | string | URL segment — lowercase, hyphenated, never changed once published. |
| `address_line_1` | string |  |
| `address_line_2` | string |  |
| `town` | string |  |
| `postcode` | string |  |
| `map_url` | string | Link to the venue on a maps provider. Opened in a new tab from the venue page. |
| `latitude` | decimal | Optional — only needed if an embedded map is added later. |
| `longitude` | decimal |  |
| `directions` | text | Plain-English directions, written for someone who has never been. |
| `parking_notes` | text | Where to park, what it costs, how full it gets on a match night. |
| `accessibility_notes` | text | Step-free access, accessible toilet, hearing loop, lighting. Required content, not optional — see the PRD's audience. |
| `table_count` | integer | How many tables are up. |
| `is_home_venue` | boolean | Marks the club's own home. Drives the 'Where we play' page. Defaults to `false`. |
| `photo` | m2o → `directus_files` | Photo of the hall, so first-time visitors recognise it. |
| `home_teams` | o2m → `hrc_teams` | Reverse list |
| `fixtures` | o2m → `hrc_fixtures` | Reverse list |
| `events` | o2m → `hrc_events` | Reverse list |
| `sessions` | o2m → `hrc_sessions` | Reverse list |

### `hrc_members`

A club member. Contact fields are private by default and never included in the public API projection — `show_on_site` governs whether the member appears publicly at all.

| Field | Type | Notes |
|---|---|---|
| `full_name` **required** | string |  |
| `slug` **required** | string | URL segment for /players/:slug. |
| `display_name` | string | Shown instead of full_name where set — nicknames, shortened names. |
| `bio` | text | Short profile. Optional; most members will not have one. |
| `status` | enum (active, lapsed, life, honorary) |  |
| `joined_year` | integer | Year they first joined HRC. |
| `show_on_site` | boolean | Opt-in, not opt-out: nothing about a member is published until this is ticked. Defaults off so a new registration is private until someone consents. Defaults to `false`. |
| `is_coach` | boolean | Defaults to `false`. |
| `is_committee` | boolean | Convenience flag; the actual roles live in hrc_committee_roles. Defaults to `false`. |
| `email` | string | PRIVATE — never returned by the public API. |
| `phone` | string | PRIVATE — never returned by the public API. |
| `league_player_ref` | string | Identifier for this player in the league's system, used to attach synced averages and handicaps. |
| `clerk_user_id` | string | External identity from Clerk, set when a member first signs in. Deliberately here rather than as a custom field on directus_users — this instance's directus_users is shared with other projects and must not be extended by this one. |
| `photo` | m2o → `directus_files` | Head-and-shoulders photo. Only published when show_on_site is ticked. |
| `captained_teams` | o2m → `hrc_teams` | Reverse list |
| `squad_places` | o2m → `hrc_squads` | Reverse list |
| `rubbers` | o2m → `hrc_rubbers` | Reverse list |
| `season_stats` | o2m → `hrc_player_stats` | Reverse list |
| `honours` | o2m → `hrc_honours` | Reverse list |
| `articles` | o2m → `hrc_news` | Reverse list |
| `led_sessions` | o2m → `hrc_sessions` | Reverse list |
| `committee_roles` | o2m → `hrc_committee_roles` | Reverse list |
| `handled_enquiries` | o2m → `hrc_enquiries` | Reverse list |

### `hrc_teams`

An HRC team in a given season — HRC A, HRC B, HRC C. One row per team per season, so history is preserved when a team changes division.

| Field | Type | Notes |
|---|---|---|
| `name` **required** | string | As the league writes it, e.g. "HRC A". |
| `slug` **required** | string | URL segment, e.g. "hrc-a" in /teams/hrc-a — matches the league's own new URL scheme. |
| `division` **required** | enum (premier, division_1, division_2) |  |
| `home_night` | enum (monday, tuesday, wednesday, thursday, friday, saturday, sunday) | The night this team plays at home. |
| `home_start_time` | time | Usual start time for a home match. |
| `is_active` | boolean | Untick rather than delete when a team folds — its fixtures and results stay readable. Defaults to `true`. |
| `sort` | integer | Display order: A, B, C. |
| `league_team_ref` | string | Identifier in the league system, e.g. "HRC A", used by the fixture sync. |
| `description` | text | A sentence or two about the team's level, for someone deciding where they might fit. |
| `season` **required** | m2o → `hrc_seasons` |  |
| `captain` | m2o → `hrc_members` | Captain for this season. SET NULL so removing a member does not delete the team. |
| `home_venue` | m2o → `hrc_venues` |  |
| `team_photo` | m2o → `directus_files` |  |
| `squad` | o2m → `hrc_squads` | Reverse list |
| `fixtures` | o2m → `hrc_fixtures` | Reverse list |
| `player_stats` | o2m → `hrc_player_stats` | Reverse list |
| `honours` | o2m → `hrc_honours` | Reverse list |

### `hrc_squads`

Which members are registered for which team in which season. The join row, not a copy of the member — a player who moves from the B to the A team gets a second row, and last season's squad list stays correct.

| Field | Type | Notes |
|---|---|---|
| `role` | enum (captain, vice_captain, player, reserve) |  |
| `registered_on` | date | Date the league registration was accepted. |
| `is_active` | boolean | Untick when a player leaves the squad mid-season; the row stays for the record. Defaults to `true`. |
| `sort` | integer | Board order within the team. |
| `team` **required** | m2o → `hrc_teams` |  |
| `member` **required** | m2o → `hrc_members` |  |
| `season` **required** | m2o → `hrc_seasons` |  |

### `hrc_fixtures`

Every match an HRC team plays, fixture and result in one row. Mirrored from the league's data by the sync job — `league_fixture_ref` and `last_synced_at` are what make the sync idempotent. Club-authored fields (report, photos) survive re-sync because the sync only writes the columns it owns.

| Field | Type | Notes |
|---|---|---|
| `played_on` | date | Match date. The site's single ordering key for fixtures and results. |
| `start_time` | time |  |
| `week_commencing` | date | Monday of the league week. The league schedules by week; this is what the fixture calendar groups on. |
| `competition` | enum (league, creasey_cup, clifford_troll_trophy, msd_trophy, hertford_builders_trophy, closed_championship, club_championship, friendly) |  |
| `opponent_name` **required** | string | Opposing team as the league names it, e.g. "Water Lane B". |
| `opponent_slug` | string | Slug of the opposing team, for linking to the league site. |
| `is_home` | boolean | Home or away. Never the only signal in the UI — it always carries a text label too. Defaults to `true`. |
| `status` | enum (scheduled, played, postponed, cancelled, void) |  |
| `result` | enum (win, loss, draw) | From HRC's point of view, regardless of home or away. Null until the card is confirmed. |
| `hrc_score` | integer | Rubbers won by HRC. |
| `opponent_score` | integer | Rubbers won by the opposition. |
| `league_fixture_ref` | string | Stable identifier in the league system. The sync matches on this, so re-running it updates rather than duplicates. |
| `scorecard_url` | string | Deep link to the full scorecard on the league site. |
| `report` | text | Club-written match report. Authored here, never touched by the sync. |
| `last_synced_at` | timestamp | When the sync last wrote to this row. Shown as 'last updated' on the fixtures page. |
| `team` **required** | m2o → `hrc_teams` |  |
| `season` **required** | m2o → `hrc_seasons` |  |
| `venue` | m2o → `hrc_venues` | Where it is played. For away matches this is the opposition's hall, if known. |
| `report_image` | m2o → `directus_files` |  |
| `rubbers` | o2m → `hrc_rubbers` | Reverse list |
| `reports` | o2m → `hrc_news` | Reverse list |

### `hrc_rubbers`

Individual rubbers within a match — the club's own copy of the scorecard. Optional detail: a fixture is complete and displayable without any rubber rows.

| Field | Type | Notes |
|---|---|---|
| `rubber_number` | integer | Order on the card, 1-9. |
| `opponent_player_name` | string |  |
| `sets_for` | integer | Sets won by the HRC player. |
| `sets_against` | integer |  |
| `won` | boolean | Whether the HRC player won the rubber. Defaults to `false`. |
| `score_detail` | string | Set scores as written on the card, e.g. "11-8, 9-11, 11-6, 11-7". |
| `fixture` **required** | m2o → `hrc_fixtures` |  |
| `member` | m2o → `hrc_members` | The HRC player. SET NULL rather than CASCADE so removing a member never erases match history. |

### `hrc_standings`

A cached league table row, mirrored from the league. Includes every team in the division, not just HRC's — a table showing only your own row is useless. Wholly owned by the sync; never edited by hand.

| Field | Type | Notes |
|---|---|---|
| `division` **required** | enum (premier, division_1, division_2) |  |
| `position` | integer |  |
| `team_name` **required** | string |  |
| `is_hrc` | boolean | Marks HRC's own rows so the table can highlight them — with a text label, never colour alone. Defaults to `false`. |
| `played` | integer |  |
| `won` | integer |  |
| `drawn` | integer |  |
| `lost` | integer |  |
| `sets_for` | integer |  |
| `sets_against` | integer |  |
| `points` | integer |  |
| `last_synced_at` | timestamp |  |
| `season` **required** | m2o → `hrc_seasons` |  |

### `hrc_player_stats`

Per-member, per-season playing record — the club's slice of the league averages, plus the handicap. One row per member per season per team.

| Field | Type | Notes |
|---|---|---|
| `division` | enum (premier, division_1, division_2) |  |
| `played` | integer |  |
| `won` | integer |  |
| `lost` | integer |  |
| `win_percentage` | decimal | Stored rather than computed on read so the averages page is a plain select with no arithmetic on the request path. |
| `handicap` | integer | League handicap rating for the season. |
| `meets_participation_threshold` | boolean | The league's 50% rule: below it a player is listed but not eligible for the averages placings. Explained in plain English next to the table, per the PRD. Defaults to `false`. |
| `last_synced_at` | timestamp |  |
| `member` **required** | m2o → `hrc_members` |  |
| `season` **required** | m2o → `hrc_seasons` |  |
| `team` | m2o → `hrc_teams` |  |

### `hrc_honours`

The club's roll of honour — titles, trophies and individual awards, by season. The league audit called its 1970-onwards honours the single most valuable thing on the site; this is the club-scale equivalent, and the one collection worth back-filling by hand from paper records.

| Field | Type | Notes |
|---|---|---|
| `title` **required** | string | e.g. "Division 1 champions", "Creasey Cup winners". |
| `honour_type` | enum (team, individual) |  |
| `competition` | enum (league, creasey_cup, clifford_troll_trophy, msd_trophy, hertford_builders_trophy, closed_championship, club_championship, friendly) |  |
| `season_label` **required** | string | Season as text, e.g. "1974-75". Deliberately a string as well as an optional hrc_seasons link — honours go back further than the seasons the site will ever hold rows for. |
| `awarded_on` | date |  |
| `recipient_name` | string | Free-text recipient, for historic honours won by people who are not (and never will be) hrc_members rows. |
| `notes` | text |  |
| `sort` | integer |  |
| `season` | m2o → `hrc_seasons` | Optional — only set for seasons the site actually holds. |
| `member` | m2o → `hrc_members` | Set for individual honours where the recipient is a current member row. |
| `team` | m2o → `hrc_teams` |  |
| `photo` | m2o → `directus_files` |  |

### `hrc_pages`

Editable static pages — about the club, how to join, coaching, safeguarding, privacy. Everything the committee should be able to reword without a deploy.

| Field | Type | Notes |
|---|---|---|
| `title` **required** | string | The page name players already use. Not reworded — see the PRD's 'new look, same map'. |
| `subtitle` | string | The plain-English one-liner shown beneath the title, e.g. "Where and when we play". An addition to the name, never a replacement. |
| `slug` **required** | string | URL segment — lowercase, hyphenated, never changed once published. |
| `body` | text | Markdown. Rendered server-side so the page is readable with JavaScript off. |
| `status` | enum (draft, published, archived) |  |
| `nav_group` | enum (home, play, teams, news, about, hidden) | Which of the five top-level menu entries this page sits under. |
| `nav_sort` | integer |  |
| `seo_description` | string |  |
| `published_at` | timestamp |  |
| `hero_image` | m2o → `directus_files` |  |

### `hrc_news`

News, notices, match reports and newsletters. The one collection the club will write to weekly.

| Field | Type | Notes |
|---|---|---|
| `title` **required** | string |  |
| `slug` **required** | string | URL segment — lowercase, hyphenated, never changed once published. |
| `summary` | string | One or two sentences, shown in listings and used as the meta description. |
| `body` | text |  |
| `category` | enum (news, match_report, notice, newsletter) |  |
| `status` | enum (draft, published, archived) |  |
| `is_pinned` | boolean | Keeps an item at the top of the news list and on the home page until unticked. Defaults to `false`. |
| `published_at` | timestamp | Ordering key for the news list. Set when status first becomes published. |
| `expires_at` | timestamp | Optional — notices disappear from the home page after this, but stay readable at their own URL. |
| `author` | m2o → `hrc_members` |  |
| `fixture` | m2o → `hrc_fixtures` | Set on a match report to link it to the match it is about, and vice versa. |
| `hero_image` | m2o → `directus_files` |  |
| `attachment` | m2o → `directus_files` | PDF newsletter, where the item is a newsletter rather than a post. |

### `hrc_events`

Club events with a date — AGM, presentation evening, club championship, open days, socials.

| Field | Type | Notes |
|---|---|---|
| `title` **required** | string |  |
| `slug` **required** | string | URL segment — lowercase, hyphenated, never changed once published. |
| `starts_at` | timestamp | Ordering key. Events in the past drop off the home page but keep their URL. |
| `ends_at` | timestamp |  |
| `description` | text |  |
| `status` | enum (scheduled, cancelled, completed) |  |
| `is_members_only` | boolean | Defaults to `false`. |
| `entry_url` | string | External entry or booking link, where there is one. |
| `cost_note` | string | Plain English, e.g. "£5 on the night, juniors free". |
| `venue` | m2o → `hrc_venues` |  |
| `hero_image` | m2o → `directus_files` |  |

### `hrc_sessions`

The weekly timetable — club nights, junior sessions, coaching. The single most-visited piece of information on any club website: when can I turn up and play?

| Field | Type | Notes |
|---|---|---|
| `name` **required** | string | e.g. "Club night", "Junior coaching". |
| `day_of_week` **required** | enum (monday, tuesday, wednesday, thursday, friday, saturday, sunday) |  |
| `start_time` | time |  |
| `end_time` | time |  |
| `session_type` | enum (club_night, junior, coaching, social, league_match, tournament) |  |
| `suitable_for` | string | Plain English, e.g. "All abilities, adults and juniors 11+". Answers the question a beginner actually has. |
| `cost_note` | string | e.g. "£4 members, £6 visitors". |
| `is_active` | boolean | Untick out of season rather than deleting. Defaults to `true`. |
| `notes` | text |  |
| `sort` | integer |  |
| `venue` **required** | m2o → `hrc_venues` |  |
| `lead_coach` | m2o → `hrc_members` |  |

### `hrc_membership_options`

Membership tiers and fees, as shown on the 'Join us' page.

| Field | Type | Notes |
|---|---|---|
| `name` **required** | string | e.g. "Adult", "Junior (under 18)", "Student". |
| `price_pence` | integer | Stored in pence to avoid float rounding. Formatted for display by the client. |
| `period` | enum (season, month, session) |  |
| `includes` | text | What the fee covers, as a short list. |
| `is_active` | boolean | Defaults to `true`. |
| `sort` | integer |  |

### `hrc_committee_roles`

Who does what. Carries a role-based public email (chair@…) rather than a personal address, so the page needs no edit when the post changes hands and no personal address is published.

| Field | Type | Notes |
|---|---|---|
| `role_title` **required** | string | e.g. "Chair", "Match secretary", "Safeguarding officer". |
| `public_email` | string | Role-based address, safe to publish. Personal addresses live on hrc_members and are never served. |
| `responsibilities` | text |  |
| `sort` | integer |  |
| `is_active` | boolean | Defaults to `true`. |
| `member` | m2o → `hrc_members` |  |

### `hrc_documents`

Downloadable files — constitution, minutes, membership form, safeguarding policy.

| Field | Type | Notes |
|---|---|---|
| `title` **required** | string |  |
| `slug` **required** | string | URL segment — lowercase, hyphenated, never changed once published. |
| `category` | enum (constitution, minutes, forms, policies, handbook, newsletter, other) |  |
| `description` | text | One line saying what the document is, so nobody downloads a PDF to find out. |
| `document_date` | date | Date on the document itself — the meeting date for minutes. |
| `is_public` | boolean | Untick for documents only members should see. Defaults to `true`. |
| `sort` | integer |  |
| `file` | m2o → `directus_files` | The file itself, served through the app rather than linked directly. |

### `hrc_gallery_albums`

A set of photos from one occasion — presentation night, a cup final, an open day.

| Field | Type | Notes |
|---|---|---|
| `title` **required** | string |  |
| `slug` **required** | string | URL segment — lowercase, hyphenated, never changed once published. |
| `description` | text |  |
| `taken_on` | date |  |
| `status` | enum (draft, published, archived) |  |
| `sort` | integer |  |
| `cover_image` | m2o → `directus_files` |  |
| `items` | o2m → `hrc_gallery_items` | Reverse list |

### `hrc_gallery_items`

One photo in an album. `caption` doubles as the alt text — required, not optional, for the same accessibility reasons the PRD sets out.

| Field | Type | Notes |
|---|---|---|
| `caption` **required** | string | Also used as the image's alt text. Describe what is in the photo, not 'photo'. |
| `sort` | integer |  |
| `album` **required** | m2o → `hrc_gallery_albums` |  |
| `image` | m2o → `directus_files` |  |

### `hrc_sponsors`

Sponsors and supporters, shown in the footer and on a sponsors page.

| Field | Type | Notes |
|---|---|---|
| `name` **required** | string |  |
| `url` | string |  |
| `tier` | enum (principal, supporting, friend) |  |
| `description` | text |  |
| `is_active` | boolean | Defaults to `true`. |
| `sort` | integer |  |
| `logo` | m2o → `directus_files` |  |

### `hrc_links`

Outward links — the league site, Table Tennis England, the county association, local clubs.

| Field | Type | Notes |
|---|---|---|
| `label` **required** | string |  |
| `url` **required** | string |  |
| `category` | string |  |
| `description` | text |  |
| `sort` | integer |  |
| `is_active` | boolean | Defaults to `true`. |

### `hrc_faqs`

The 'How do I…?' content the PRD asks for — the handful of questions a newcomer or an older member actually asks, answered in plain English.

| Field | Type | Notes |
|---|---|---|
| `question` **required** | string |  |
| `answer` | text |  |
| `category` | string |  |
| `sort` | integer |  |
| `is_published` | boolean | Defaults to `true`. |

### `hrc_enquiries`

Submissions from the contact and join forms. The only collection the public can write to, and the only one the service token may create rows in without an authenticated member behind the request — so it is rate-limited, honeypot-protected and moderated. Never publicly readable.

| Field | Type | Notes |
|---|---|---|
| `name` **required** | string |  |
| `email` **required** | string |  |
| `phone` | string |  |
| `enquiry_type` | enum (join, coaching, juniors, venue_hire, general) |  |
| `message` | text |  |
| `status` | enum (new, in_progress, answered, spam) |  |
| `source_page` | string | Path the form was submitted from, for working out which page prompts enquiries. |
| `internal_notes` | text | Committee-only. Never returned to the submitter. |
| `handled_by` | m2o → `hrc_members` |  |

### `hrc_site_settings`

One row. Club identity and the few site-wide switches the committee should own — name, strapline, contact address, social links, and the banner that goes up when a session is cancelled.

| Field | Type | Notes |
|---|---|---|
| `club_name` **required** | string |  |
| `short_name` | string |  |
| `strapline` | string | One line, shown under the club name in the header. |
| `founded_year` | integer |  |
| `about_summary` | text | Two or three sentences for the home page and search results. |
| `contact_email` | string | Role-based, publishable address. |
| `phone` | string |  |
| `facebook_url` | string |  |
| `instagram_url` | string |  |
| `league_url` | string | The league site. Linked from fixtures, tables and averages as the source of the data. |
| `announcement` | text | Site-wide banner — a cancelled session, a change of hall. Empty means no banner. |
| `announcement_expires_at` | timestamp | Banner hides itself after this, so nobody has to remember to take it down. |
| `current_season` | m2o → `hrc_seasons` | Redundant with hrc_seasons.is_current, and deliberately so — this is the one the admin panel makes obvious. |
| `logo` | m2o → `directus_files` |  |
| `crest` | m2o → `directus_files` |  |
| `og_image` | m2o → `directus_files` | Link-preview image for social shares. |

<!-- END GENERATED SCHEMA -->

## 6. Flows to provision

Not yet built — specified here as Phase 2 work.

| Flow | Trigger | Does |
|---|---|---|
| **Publish rebuild** | Item create/update on `hrc_pages`, `hrc_news`, `hrc_events`, `hrc_sessions`, `hrc_venues`, `hrc_documents`, `hrc_site_settings` | POSTs the Vercel Deploy Hook, so an edit is live in about a minute |
| **Result rebuild** | Item create/update on `hrc_fixtures`, `hrc_standings`, `hrc_player_stats` | Same hook, debounced — a sync run touching 30 rows should cause one build, not thirty |
| **Enquiry notification** | Item create on `hrc_enquiries` | Emails the committee address via Directus's own mail transport |
| **Enquiry acknowledgement** | Item create on `hrc_enquiries` | Emails the submitter "we've got it, someone will reply" |
| **Announcement expiry** | Scheduled, hourly | Clears `announcement` once `announcement_expires_at` passes, so nobody has to remember to take the banner down |

Email goes through Directus Flows rather than the app server for the same reason it does in pintogather: this instance's SMTP relay is reachable from the Directus container and not from a Vercel function.

## 7. Season rollover

The one recurring operation with more than one step. Worth a written checklist because it happens once a year and nobody remembers it:

1. Create the new `hrc_seasons` row; set `is_current` on it and clear it on the old one.
2. Point `hrc_site_settings.current_season` at it.
3. Create the three `hrc_teams` rows for the new season, with divisions and captains.
4. Create `hrc_squads` rows as registrations are accepted.
5. Add the previous season's titles and awards to `hrc_honours`.
6. Run the league sync to populate fixtures.

Past seasons remain reachable at `/seasons/:label/*`. Nothing is deleted, ever.

## 8. Reproducing this schema

```bash
cd directus
cp .env.example .env    # fill in ADMIN_EMAIL / ADMIN_PASSWORD
npm install
npm run schema:apply    # idempotent — a second run makes no changes
```

`schema:apply` is safe to re-run at any time: it creates what is missing and reports what already exists. It is how a field gets added — edit `definitions.ts`, re-run — and it is the reason this document can claim to match the instance.
