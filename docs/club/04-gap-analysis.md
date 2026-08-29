# Gap Analysis — this site against `hertsttl.org.uk`

**Written:** 29 August 2026
**Compared against:** `hertsttl.org.uk/Home.htm` and every page it links to, crawled 29 August 2026
**Applies to:** `kipergil/hrc-club`

---

## 1. Method

The original home page carries **51 links** across nine menu groups. Every one was followed,
the response decoded from Windows-1252 and flattened to text, and the resulting feature list
compared against our 33 routes plus a not-found (`client/src/App.tsx`) and the current contents of the
Directus collections.

Three things are being measured separately, because they fail differently and are fixed
differently:

- **Does the page exist here?** A routing and design question.
- **Does the page hold the data?** A content-import question. A page that exists and renders
  an empty state is not the same as a page that is missing, but to a reader it is worse —
  it looks broken rather than absent.
- **Does the page do what the original page does?** A feature question. `/cups` exists and
  lists cup fixtures; the original's Cup News page explains the four cups, their format, the
  eligibility rule and the finals night. Same route, different job.

A note on framing. This is a **club** site that carries league data, not a replacement for the
league site (see [00-scope-and-architecture.md](00-scope-and-architecture.md) §1). Some of what
follows is therefore listed as *deliberately not carried across* rather than missing — §6. That
distinction is the point of the document: without it, "missing" would include the result-entry
system we decided on day one not to build.

---

## 2. Headline

| | Count |
|---|---|
| Original features fully covered | 21 |
| Built but rendering empty for want of data | 4 |
| Built but materially thinner than the original | 6 |
| Missing entirely | 8 |
| Deliberately out of scope | 5 |
| Here but not on the original | 12 |

**The single biggest gap is not a feature — it is data.** Four pages that exist, are designed,
are tested and are prerendered have nothing to show:

```
hrc_fixtures     200   all 2026-27, all league, all status=scheduled, none with a score
hrc_rubbers        0   no scorecards at all
hrc_player_stats   0   /averages and /handicaps render their empty state
hrc_standings      0   (expected — the table is derived from results, and there are none yet)
hrc_honours      725   the roll of honour is the one historical dataset we did import
```

The 2025-26 season row exists but holds nothing. So the season filter built in the last
change — the thing that makes multi-year data possible — currently has one season to filter
by. That is the first thing to fix, and §7 puts it first.

---

## 3. Covered — the original feature exists here and works

| Original | Here | Notes |
|---|---|---|
| `Tables.asp` — league tables, three divisions | `/tables` | Derived from results rather than stored, with rule 20 tie-breaks. Season filter. |
| Team name → that team's season matches | `/teams/:slug` | The original's `MatchHistory.asp?Team=…`, rebuilt. |
| `Clubz.asp?Club=…` × 10 | `/clubs`, `/clubs/:slug` | All 10 clubs, 9 venues, 26 teams, 165 squad places. |
| Club venue + map link | `/clubs/:slug` | `venue.mapUrl`, opens in a new tab. |
| Players listed by team | `/clubs/:slug`, `/teams/:slug` | 165 members. |
| `Averages.asp` (the page) | `/averages` | Built, including the <50 %-of-matches eligibility marker. Empty — see §4. |
| `Handicaps.asp` (the page) | `/handicaps` | Built. Empty — see §4. |
| `RollofHonour…htm` | `/honours` | 725 rows, back to 1950. The most complete import we have. |
| `Newz.asp?NlNo=…` | `/newsletters`, `/news/:slug` | |
| `Notices.asp` | `/news` | The original is empty today ("There are no current notices!"). |
| Forms & Documents (the PDFs and DOCs) | `/documents` | 10 of 14 held; see §5 for the four that are not. |
| `Links.htm` + the supplier links | `/links` | 13 links, categorised. |
| Committee contacts on the home page | `/committee` | 6 roles with holders. |
| Home-page league blurb ("13th oldest TT league in the UK", the affiliations) | `/about`, `/about/history` | |
| Home-page announcement banner (AGM date) | `LeagueNotice` | Dismissible, keyed per announcement. |
| "Site last updated" stamp | `SyncNote` | Per page, from `lastSyncedAt`. |
| `Feedback.asp?Msg=Ask` | `/contact` | |
| "Ctrl & P to print / landscape is best" | `PrintButton` + print stylesheet | Handled by CSS rather than by instructing the reader. |
| Fixture list for the season | `/fixtures` | Grouped by week commencing. |
| All league matches this season | `/results` | |
| TTE membership renewal (Sport80) | `/links` | Kept as an outward link. |

---

## 4. Built but empty — the data has not been imported

These four are the difference between a site that looks finished and one that is finished.
None needs new UI.

### 4.1 Results and scores for 2026-27

**Original:** every played match on `Tables.asp` → team → match history, with the rubber score.
**Here:** 200 fixtures imported, every one `status=scheduled`, no `home_score`/`away_score`.
**Why:** the 2026-27 season starts w/c 14 September 2026 — the original has no results either
yet. This one resolves itself, provided the import runs during the season.
**Work:** schedule `import:fixtures` (or a Directus Flow) so results land as they are posted.

### 4.2 The whole 2025-26 season

**Original:** "click here for last season's averages" and "last season's final tables".
**Here:** an `hrc_seasons` row for 2025-26 with zero fixtures, standings or stats behind it.
**Why this matters:** the season filter is the feature the client asked for by name. With one
populated season it is a control with nothing to control.
**Work:** re-run the `MatchHistory.asp` importer against last season's archived pages, mapping
to the 2025-26 season row. The parser already exists and is tested; only the season binding
and the source URLs change.

### 4.3 Player averages

**Original:** `Averages2025.htm` — ~80 KB, every player grouped by division, played/won/percentage,
with under-50 %-of-matches players greyed out of the placings.
**Here:** `/averages` renders, `hrc_player_stats` is empty.
**Work:** either import the original's averages table, or — better — derive averages from
`hrc_rubbers` the same way the league table is now derived from fixtures, so one import
feeds both. That is the same argument that produced `buildTable()`.

### 4.4 Handicaps

**Original:** `Handicaps.asp`, with a club filter row across the top. Today it says "too early —
try again around Christmas".
**Here:** `/handicaps` renders from the same empty `hrc_player_stats`.
**Work:** follows 4.3. The club filter is a UI gap — §5.6.

---

## 5. Built but thinner than the original

### 5.1 The fixture calendar is a list; the original is a grid

**Original:** `Calendarz.asp?Div=0|1|2` → a per-division grid. Teams down the left, **16 week
columns across**, one row per team, so a captain sees their team's entire half-season on one
screen. Away fixtures in italics. Cells marked `No Match` for a bye. Vertical spacer columns
label the cup and free weeks. A second grid below for the January–April half. Hover a cell for
more detail.

**Here:** `/fixtures` is a chronological list grouped by week, four weeks per page.

This is the largest single feature gap, and the original's design is genuinely better for the
job it does. A list answers "what is on this week"; the grid answers "when do we play Water
Lane, and which weeks are we free" — which is the question a captain arranging a rearrangement
actually has.

**Work:** a `/fixtures/calendar/:division` route rendering a `<table>` of teams × weeks from the
same `useFixtures` data, with the week columns horizontally scrollable inside their own
container and a per-team row on narrow screens. Away/home as a visible marker, not italics alone
(italics are colour-adjacent: they cannot be the only signal). Byes and cup weeks come from the
fixture data we already hold, once cup fixtures are imported (§6.1).

### 5.2 Cup News is a fixture list; the original is a rulebook

**Original:** `CupNews.asp` carries, in prose:

- The eligibility rule — one team per cup; playing up binds you to the higher team.
- The three divisional cups **by name**: Creasey Cup (Premier), Clifford Troll Trophy
  (Division One), MSD Trophy (Division Two), plus the handicap cup.
- The format: straight knockout, best of five sets, 11 up, two clear, nine rubbers per
  match (six singles, three doubles).
- Why there is a preliminary round (nine teams in Divisions One and Two).
- The round calendar and finals night — w/c Mon 14 December 2026, venue TBA.
- Links to the divisional and handicap scoresheets.

**Here:** `/cups` filters fixtures to `competition=cup` and shows two lists. `hrc_fixtures` holds
**no cup fixtures at all**, so today the page shows only its empty state.

**Work:** two parts. Import the cup fixtures (they are on the same `Calendarz` pages). And model
the cups themselves — a `hrc_competitions` collection with name, division, format and rules
prose — so `/cups` can lead with what the cups *are* before listing what is on. The rules are
stable season to season; the fixtures are not.

### 5.3 No scorecard, and no way to reach one

**Original:** every match row carries three icons — a sheet of paper (print a blank scoresheet),
a magnifying glass (view the completed card), a pencil (enter the card, sign-in required).
`SingleScoreCard.htm` is a 56 KB interactive scorecard.

**Here:** `Rubber` and `FixtureDetail` are modelled — rubber number, players, sets for/against,
`scoreDetail` — and `/results/:id` renders them. `hrc_rubbers` is empty, so no match has a card.
`scorecardUrl` exists on `Fixture` but nothing populates it.

**Work:** the *viewing* half is small — import rubbers with results, and the existing match page
shows them. The doubles case needs a schema change: a rubber currently names one player per side,
and three of the nine are doubles. The *entry* half is §6 — deliberately not ours.

### 5.4 Averages are not grouped by division

**Original:** three tables, one per division, which is how placings are actually awarded.
**Here:** one table with search. Add a division grouping (the pattern already exists on `/teams`).

### 5.5 Club pages do not show the team contact

**Original:** each team lists its captain/contact by name, with email and phone **gated behind
sign-in** — "LogIn to see".
**Here:** teams show home night and squad, no named contact.
**Work:** a `contact_member` relation on `hrc_teams`, showing the name publicly and the contact
details only to signed-in members. Public name / private details is the right split and matches
what the original does; it is also the first thing that would need the members' area to exist.

### 5.6 Small things

- **Handicaps club filter.** The original has a club row across the top. We have search but no
  club chips. `FilterChips` already exists.
- **"Outstanding matches".** `Tables.asp` links to a list of matches that should have been
  played and have no result. It is a nag list for the match secretary and genuinely useful.
  Derivable from what we hold: `status=scheduled` and `weekCommencing` in the past.
- **"Played up/down" marker.** The original italicises a player who has played for a team other
  than the one they registered with. We hold `hrc_squads` but do not mark this. Again: needs a
  non-italic signal.

---

## 6. Missing entirely

| # | Original | What it does | What it would take here |
|---|---|---|---|
| 6.1 | `Calendarz.asp?Div=0/1/2` | Per-division season grid | §5.1 |
| 6.2 | `ClosedInvite.asp` | Online entry form for the Closed Competition, gated on being on the league's email list | A form + a Directus collection for entries. Ours would post to the existing contact endpoint rather than build a second one. |
| 6.3 | `HCapApp1.asp` | Online entry for the Handicap Competition | **The original 404s.** Its DOC and HTM forms still work from Forms & Documents. Worth rebuilding as one form covering both competitions, since the original's is broken. |
| 6.4 | `CommitteeMinutes.htm` | Minutes archive, separate from the AGM PDF | A `category` on `hrc_documents` and a section on `/documents`. Not imported — it is one of the four HTML documents below. |
| 6.5 | `SingleScoreCard.htm`, `CupScoresheetNew.htm`, `CupScoresheetHNew.htm`, `HandicapForm…htm`, `ClosedForm…htm` | Interactive HTML scorecards and forms | Four of the 14 documents are HTML pages, not files, so the importer skipped them (it copies files and links URLs). Either link them out or rebuild the league scorecard as a real page. |
| 6.6 | Cup rules, formats and calendar | §5.2 | §5.2 |
| 6.7 | Per-team contact details behind sign-in | §5.5 | §5.5 |
| 6.8 | "Contact our Webmaster to get notices posted here" | The route by which a notice reaches the site | `/contact` covers it, but nothing on `/news` says so. One line on the empty state. |

---

## 7. Deliberately not carried across

Listed so that nobody re-derives them later as oversights.

| Original | Why not |
|---|---|
| `Admin.asp?ADMI=0` → `SignIn.asp` | The captain/match-secretary result-entry system. **This is the league's job, not the club's** — §1 of the architecture doc: "two places to enter a result means two answers to what the score was." We read results; we never accept them. |
| The pencil icon on every match | Same. |
| `LogMeIn.asp` | Same sign-in. A members' area here would be for club business, not scoring. |
| Registration fee handling | Out of scope by instruction — no pricing, membership or monetisation UI. `/join`, `/coaching`, `/juniors` and `/sponsors` were removed for the same reason and are not in `App.tsx`. |
| Frames, the visitor counter, the "views expressed are not necessarily those of…" disclaimer | Not features. |

---

## 8. What we have that the original does not

Worth stating, because a gap analysis that only counts what is missing reads as a worse site
than we have.

- Real HTML at build time for 237 routes — readable with JavaScript off.
- Season filtering as a first-class concept, on tables and fixtures.
- League tables **derived** from results rather than typed in, so they cannot disagree with the
  match history.
- Per-team match history with win/loss framing computed for the team you are looking at.
- Search on every long list; pagination on every long table.
- Breadcrumbs, a page-foot back/home/top block, and scroll restoration that puts you at the
  top of a page you navigate to and back where you were when you go back.
- A checked-contrast palette (45 assertions in `scripts/contrast.test.ts`), A/A+/A++ text sizing,
  48 px targets, dark mode.
- Venue detail pages with directions, parking and access.
- News, events and a gallery.
- Privacy, accessibility and safeguarding statements.
- A print stylesheet, so "Ctrl & P, landscape is best" is unnecessary.
- FAQs (`/help`).

---

## 9. Suggested order

Data before features, because four finished pages are currently showing empty states and that
is the most visible defect on the site.

1. **Import 2025-26 in full** — fixtures, results, rubbers, averages, final tables. Turns the
   season filter into a real control and fills `/results`, `/tables`, `/averages`, `/handicaps`.
   (§4.2, §4.3, §4.4)
2. **Import the 2026-27 cup fixtures** and schedule the fixture import to run through the
   season. (§4.1, §5.2)
3. **The division calendar grid.** (§5.1) The largest genuine feature gap.
4. **Cup News as a page about the cups**, not only a fixture list — model `hrc_competitions`.
   (§5.2)
5. **Scorecards on the match page**, including the doubles schema change. (§5.3)
6. **The small ones together**: averages by division, handicaps club filter, outstanding
   matches, played-up marker, the four HTML documents, the webmaster line on `/news`. (§5.4–5.6, §6.4, §6.5, §6.8)
7. **Team contacts behind sign-in** (§5.5) — first item that requires the members' area, so it
   sets the schedule for that.
8. **Competition entry forms** (§6.2, §6.3) — lowest traffic, and one of the two is broken on
   the original.
