# Match cards — model, parsing and entry

**Written:** 1 September 2026
**Applies to:** `kipergil/hrc-club`

---

## 1. The card

Everything here follows one document: `hertsttl.org.uk/SingleScoreCard.htm`, the sheet captains
fill in on the night. Its structure is not a convention this site invented and is not ours to
change.

- **Three players a side.** Home are **A, B, C**; away are **X, Y, Z**.
- **Nine singles in a fixed printed order**, then a **doubles** — ten rubbers:

  ```
  1. A v X   2. B v Y   3. C v Z   4. B v X   5. A v Z
  6. C v Y   7. B v Z   8. C v X   9. A v Y  10. Doubles
  ```

  Not alphabetical: the interleaving is what stops a player having two rubbers in a row.
- **Best of five games**, 11 up, win by two clear. The card has five game columns and a SETS
  column.
- Ten rubbers a match, so **a team's league points are the rubbers it won**. That is what makes
  Water Lane A's 118 points from fourteen matches in 2025-26 a real number and not a typo.

That last line is the reason the model is shaped this way rather than storing a match score:
the score is a *consequence* of the card, and deriving it is what stops the two disagreeing.

## 2. The data model

### `hrc_rubbers` — rebuilt

The previous shape was one-sided — a single `member`, the opponent as free text, and
`sets_for`/`sets_against` measured from them. Right when this was one club's site; wrong the
moment it carried the league. On an away match the recorded player was the visitor, so every
consumer had to know which side a row had been written from, and the match page got it wrong
for every away match until somebody looked closely.

It is now symmetrical:

| Column | Why |
|---|---|
| `rubber_number` | 1-9 singles in the card's order, 10 the doubles |
| `kind` | `singles` or `doubles` — only the doubles has two a side |
| `home_player`, `home_player_2` | Relations to `hrc_members` |
| `away_player`, `away_player_2` | Same, the other side |
| `home_player_name`, `away_player_name` | The name as written, where it matched no member — a guest, or a spelling nobody has reconciled |
| `home_sets`, `away_sets` | Derived from `games` on save, never accepted from a caller |
| `games` | `[[11,8],[9,11],[11,6]]` — the card's five columns |

Games are JSON rather than a `hrc_games` table because nothing ever queries *into* them: no
page filters matches by the score of the third game. Five games are a value, not five rows.

### `hrc_scorecards` — the uploads

The photograph, the machine's reading of it, and whether a person has confirmed it. Its own
record rather than written straight onto the fixture, for three reasons: the photograph is the
evidence and a disputed result is settled by looking at the card; a parse is a draft until
somebody checks it, and `applied` is the only status that has touched the site; and when a
parse comes out wrong, the image and the raw output are both still there to work out why —
which is the only way the prompt ever improves.

## 3. Why AI output can be trusted here

A card read off a photograph is a guess until something checks it. This card is rigid enough
to check hard, and `shared/scorecard.ts` does all of it before a human ever sees the draft:

1. **The pairings are known before anyone reads the page.** Rubber 1 is A-X and rubber 4 is
   B-X, so the away player must be the same person in both. A model that misreads one of them
   cannot make them agree. This is the strongest check available and it costs nothing, because
   the order is printed on the sheet rather than decided on the night.
2. **Games must sum to the sets**, and a game must be a finished game — 11 up, two clear. An
   `11-10` is impossible and is nearly always a misread digit; a `7-3` is usually a sheet
   photographed before the match finished.
3. **Sets must sum to the match score.** The score is derived on the server from the games, so
   a card whose rows disagree with its own scoreline cannot be saved — that is the one
   inconsistency that would be invisible on every page showing the result.

Everything that fails is shown to a person, filed against the row it concerns. Two severities:
`error` blocks saving; `warning` does not. The distinction matters because a photographed card
is often *slightly* wrong in ways a human resolves in two seconds, and refusing the whole card
for a misspelled name would send the captain back to typing it out by hand — the exact thing
this feature exists to avoid.

**Names are matched confidently or not at all.** `shared/name-match.ts` matches on the full
name, the surname, or the surname plus an initial, and every strategy requires the answer to be
unique among that team's squad. "S. Smith" against a squad with two Smiths is not a match, it
is a question, and the form is where questions get asked. Fuzzy distance scoring is
deliberately absent: it is what produces confident wrong answers, and a wrong match silently
credits a rubber to the wrong player and surfaces months later in an averages table nobody can
explain.

## 4. Entering a card

`/admin/scorecards`, linked from the footer.

1. **Sign in** with the shared result-entry password.
2. **Pick the match.** Unplayed fixtures first — a card being entered is nearly always for one.
3. **Photograph, or type.** A photograph is read by Claude and lands in the review form; "type
   the card in instead" opens the same form empty. Manual entry is not a separate feature, it
   is this one with the first step skipped, which is why it keeps working with no API key.
4. **Check every line.** The photograph stays on screen beside the form — that comparison *is*
   the review. Games are typed as they are written (`11-8, 9-11, 11-6`); the sets and the match
   score work themselves out live.
5. **Save.**

The form is always ten rubbers in the card's printed order, whether anything filled them in or
not. A form that grew and shrank with what a model happened to read would hide a missing rubber
instead of showing an empty row.

### The parse

`server/lib/scorecard-ai.ts`, using `claude-opus-5` with vision and a **strict tool schema** —
not free text and not "reply with JSON", so the response either fits the shape or the call
fails. The prompt tells the model the card's fixed structure, including the pairing order,
because knowing row 4 is B-X lets it read a smudged name against the clean one in row 2. It is
explicit that an unreadable cell is left empty: a blank is visible in the review screen and a
plausible guess is not.

## 5. Configuration

| Variable | Effect if unset |
|---|---|
| `ADMIN_TOKEN` | Every scorecard endpoint returns 503. Result entry is off. |
| `ANTHROPIC_API_KEY` | Photographs cannot be read. The screen says so plainly and manual entry works normally. |
| `ANTHROPIC_WORKSPACE_ID` | Nothing, **unless the key is identity-linked** — see below. |
| `SCORECARD_MODEL` | Defaults to `claude-opus-5`. Overridable so a cheaper model can be tried against real cards without a deploy. |

**An identity-linked key needs a workspace id.** A key tied to a person rather than to one
workspace does not say which workspace a request belongs to, and the API refuses it:

```
anthropic-workspace-id is required when authenticating with an identity-linked API key
```

Set `ANTHROPIC_WORKSPACE_ID` (it looks like `wrkspc_01…`, and is on the workspace's page in the
Anthropic Console) and it is sent as a header on every call. A workspace-scoped key carries its
own workspace and needs nothing — which is why the header is sent only when configured, rather
than always and sometimes empty.

### Failing without blaming the card

The upload route distinguishes two failures, because they read completely differently to the
person holding the card:

- **503 — it could not be attempted.** No key, a key the API rejects, a workspace it will not
  infer, a model that does not exist, a rate limit, an outage. Nothing about the photograph
  would change the outcome, so the screen says so and points at manual entry. The API's own
  error text goes to the log, where an operator can find it, and never to the screen: the first
  real upload returned `400 {"type":"error",…}` verbatim to a team captain, which tells them
  nothing they can act on and does not even hint that the fix is a configuration one.
- **422 — the card is the problem.** The call succeeded and came back with no card in it.

Either way the image is filed. It is uploaded before the model is called, so any path that
returns without recording it leaves an unreferenced file in Directus on every attempt.

**`ADMIN_TOKEN` is a shared secret, not accounts.** It proves the caller knows the password and
nothing more — it cannot tell you who entered a card. That matches what the league's own site
does with its captains' sign-in, and it is compared with `timingSafeEqual` because the whole
security of the endpoint is that one string. When the members' area lands (Clerk, per
[00-scope-and-architecture.md](00-scope-and-architecture.md) §3) this is what it replaces.

Note what the Directus grants mean: the service token may write rubbers and scorecards. That
says what the *server* may do, not who may ask it to. The gate is in Express; Directus has no
idea who is signed in, and a token that could not write here would make the feature impossible
rather than safer.

## 6. Averages, derived

`/averages` is now built from the cards rather than an import, the same way the league table is
built from fixtures. A player's average changes the moment a card is entered and cannot drift
from the results behind it.

Three details were read off the league's own 2025-26 averages page rather than assumed, because
each changes the arithmetic:

- **Played counts singles rubbers, not matches.** Three singles a match, so a full fourteen-match
  season is 42. The highest figure on that page is 44 — a player who also played up for another
  team.
- **The doubles is not in it.** Including it would put a full season at 56 and nothing comes near
  that. The doubles is a pair's result, not a player's.
- **Won + Lost equals Played on all 147 rows.** A rubber cannot be drawn, so there is no third
  column to reconcile.

The 50% rule is measured in *matches* against that player's own team's programme: playing every
match of a twelve-match Division One season is not less committed than playing every match of a
fourteen-match Premier one. A player who turned out for two teams is placed with the one they
played most for, and their whole record counts.

Stored `hrc_player_stats` remains the source for archived seasons, whose rubbers this site will
never hold — the same fallback shape the league tables use.

## 7. What is not done

- **The parse has still not produced a card from a real photograph.** The first attempt against
  a real key was refused by the API before the model saw anything, because the key is
  identity-linked and no workspace id was being sent — now fixed, and covered by tests that put
  a real request on the wire against a stand-in for the API (`server/scorecard-ai.test.ts`).
  What remains unexercised is the model's actual reading of a card. Treat the first successful
  one as a test, not a migration.
- **A saved card does not mark its upload `applied`.** `hrc_scorecards` records the parse; the
  save writes rubbers. Joining the two would let the review screen show a card's history.
- **Handicaps are still not derived.** They are set by the match secretary rather than computed
  from play, so unlike averages they cannot come out of the cards — `/handicaps` needs an import
  or an entry screen of its own.
