/**
 * Ten short posts about what this site can do.
 *
 * The site gained a great deal this year that is invisible until someone
 * happens to press the right thing — that the year filter puts the season
 * in the address, that a player's page lists every game they played, that
 * the whole scorecard is on the match page. A league site cannot rely on
 * being explored: most visits come to look up one fixture and leave.
 *
 * So each of those gets a post saying what it does, where to find it, and
 * why it is worth knowing. They are filed under `feature` and read at
 * `/whats-new`, deliberately apart from the committee's own notices — a
 * run of these alongside a postponement would make the postponement
 * harder to find.
 *
 * The content lives here, in the repository, rather than being typed into
 * Directus by hand. Every claim below is about behaviour this codebase is
 * responsible for, so the two should move together: change the feature,
 * change the post, and re-run the writer.
 */

export interface FeaturePost {
  slug: string;
  title: string;
  summary: string;
  body: string;
}

/**
 * Newest first — the writer stamps them in this order, so the top of this
 * array is the top of the page.
 */
export const FEATURE_POSTS: FeaturePost[] = [
  {
    slug: "sixteen-seasons-one-address",
    title: "Sixteen seasons, one address",
    summary:
      "Every table, fixture list and average can be read for any season back to 2011-12 — and the address names the year, so a link to 2018-19 stays a link to 2018-19.",
    body: `Every page that shows a season now has a **Season** control at the top of it. This season sits on the left; the button beside it opens the other fifteen, back to 2011-12.

Pick a year and the page redraws for that year — the league tables, the fixture list, the match history, the averages, a team's season, a player's record. There is no separate archive to go and find.

## The address goes with it

Choosing 2018-19 puts it in the address bar:

    hertsttl.org.uk/tables?season=2018-19

That link is the thing worth knowing. Send it to someone and they open the 2018-19 tables, not this season's. Bookmark it and it stays put. The old site did much the same thing with a file for each year — \`Tables2018.htm\` — and the one property of that worth keeping is that the address says what you are looking at.

The current season needs no year at all. \`/tables\` is the table anyone means when they do not say.

## Where to find it

At the top of [League tables](/tables), [Averages](/averages), [Fixture calendar](/fixtures), [Match history](/results), and on every team and player page.`,
  },
  {
    slug: "the-card-exactly-as-it-was-written",
    title: "The card, exactly as it was written",
    summary:
      "Every played match now shows its full scorecard: both line-ups as A, B, C and X, Y, Z, all ten matches in playing order, and every game score.",
    body: `A league result used to be two numbers. Now every played match opens its whole card.

At the top are the two line-ups, lettered the way the paper card letters them — the home three as **A**, **B** and **C**, the visitors as **X**, **Y** and **Z**. Underneath, the ten matches in the order they were played, each with the game scores as they were written down:

> **A v X** — 11-8, 9-11, 11-6, 11-7

Nine singles and the doubles, the same order every week, so you can read down the card and see how the night actually went. A 6-4 that was three five-setters reads very differently from a 6-4 that was not.

## Why the letters matter

Keeping the card's own lettering means you can hold the paper next to the screen and check it line by line. That is the point: the site is not a summary of the card, it is the card.

## Where to find it

[Match history](/results), then any match. Every result links to its own page.`,
  },
  {
    slug: "photograph-the-card-well-do-the-typing",
    title: "Photograph the card. We'll do the typing.",
    summary:
      "For captains: photograph the scorecard, and the site reads it, matches the names to your squad and hands you a filled-in card to check before anything is published.",
    body: `This one is for captains and the results secretary.

Entering a card by hand is ten matches, twenty players' worth of names and up to fifty game scores. It is the job that makes results arrive on Thursday instead of Tuesday.

So: take a photograph of the completed card on your phone and upload it. The site reads the card, works out who played, and gives you the whole thing filled in on screen.

## It asks, it does not assume

Cards are written in pen, usually at speed, and often with first names only. Two things follow from that:

- **Names are matched against your squad**, first names first. "Dave" resolves to your Dave. Where a team has two of them, the site says so and asks you to pick rather than guessing.
- **Nothing is published until you say so.** What you get is a draft to check — you can correct any name, any score, any match — and the arithmetic is checked as you go, so a match that does not add up is flagged before it is saved, not after.

The photograph is kept with the result as evidence, so there is always something to go back to.

## Where to find it

[Enter a result](/admin/scorecards), linked at the foot of every page. You will need the committee's password.`,
  },
  {
    slug: "the-league-that-adds-itself-up",
    title: "The league that adds itself up",
    summary:
      "League tables and averages are worked out from the cards as they arrive. No spreadsheet, no separate update, and nothing to forget.",
    body: `The tables and the averages are not typed in. They are worked out from the match cards, every time the page is asked for.

Enter a card and the division table moves, both teams' records change, and every player on it has their average brought up to date. There is no second job to remember and no window in which the site disagrees with itself.

## What the averages count

Singles only — the doubles is a shared result and counting it would flatter whoever played it. Each player shows matches played, matches won and a percentage.

Players who have not yet played half the season's matches are shown separately from those who have. A player who has won their only match is not top of the averages; they are a player who has won their only match, and the page says which is which.

## Handicaps

The handicap list sits on the same page furniture and fills in as the committee sets each season's ratings.

## Where to find it

[League tables](/tables) and [Averages](/averages). Both print cleanly, and both go back through the archive.`,
  },
  {
    slug: "every-game-you-played-this-season",
    title: "Every game you played this season",
    summary:
      "A player's page now lists every singles and doubles they have played — opponent by opponent, with the scores — for whichever season you choose.",
    body: `A player's page used to say which team they were in. It now shows what they have actually done.

Every match they have played this season is listed: the date, the fixture, the opponent, and how it finished. Singles and doubles both, in the order they were played, with the game scores.

Above the list are the three numbers people want: played, won, and the percentage — the same figures that put them where they are in the averages, so the two can be checked against one another.

## Any season, not just this one

The **Season** control at the top changes the year. Pick 2019-20 and you get that season's record, that season's team.

## Where to find it

[Players](/players), then a name. The list can be searched, so you do not have to scroll through all one hundred and sixty-five. Player names in the averages, in a team's squad and on a match card all link straight through.`,
  },
  {
    slug: "your-teams-whole-season-on-one-grid",
    title: "Your team's whole season, on one grid",
    summary:
      "The season calendar puts every team's fixtures on a single grid, and a team filter narrows any fixture list or result list to just your matches.",
    body: `Two ways to stop reading other people's fixtures.

## The grid

The [Season calendar](/fixtures/calendar) is every team's whole season laid out at once — teams down, weeks across. It is the view for planning: when your away run is, which week is free, who you have in March.

It prints on a sheet, which is what it is for. Pin it up in the hall in September and it is right all year.

## The filter

Every team page has its own fixture list, and clicking a team from a fixture or a result takes you to the list you actually wanted — the results if the match has been played, the fixtures if it has not. The page then says which team it is showing, with one link to clear it.

So from any match you are two clicks from that team's whole season, and one click back.

## Where to find it

[Fixture calendar](/fixtures), [Season calendar](/fixtures/calendar), [Match history](/results), or any team's page under [Teams](/teams).`,
  },
  {
    slug: "ten-clubs-one-map",
    title: "Ten clubs, one map",
    summary:
      "Every hall in the league pinned on one map, with the address, and the clubs and teams that play there.",
    body: `Nine halls, ten clubs, one map.

[Venues](/venues) shows every hall the league plays in, pinned. Click a pin for the hall's name and address; the list beneath gives the same thing in print, along with who plays there.

It answers the question a first away trip always asks — *where actually is this?* — without anyone having to ring the captain on the night.

## And the clubs

[Club details](/clubs) is the other way round: start with a club and find its hall, its teams and its divisions. Every club page names the venue and links to it on the map.

Both pages print. The venue list on one sheet is a useful thing to have in the car.

## Where to find it

[Venues](/venues) and [Club details](/clubs), both under **Clubs**.`,
  },
  {
    slug: "made-to-be-read-at-arms-length",
    title: "Made to be read at arm's length",
    summary:
      "Three text sizes, a dark setting for the evening, and a palette checked against the strictest contrast standard there is — because most of our members are the wrong side of sixty.",
    body: `Most of this league is over sixty. That is not a footnote to the design; it is the design.

## Three text sizes

**A**, **A+** and **A++**, top right of every page — inside the menu on a phone. They make everything bigger, not just the body text: headings, tables, buttons, the lot. The choice is remembered, so it is a thing you set once.

Browser zoom still works too. This is for the many people who do not know browser zoom exists.

## A dark setting

The moon button switches the site to light text on a dark background, which most people find easier at eleven at night after a match. It follows your device's own setting until you say otherwise.

## Contrast, checked rather than eyeballed

Every text and background pairing on the site is measured against WCAG's **AAA** level — the strictest of the three, 7:1 — and the build fails if any pair falls short. Not the AA level most sites stop at. That is why the reds are as dark as they are.

Every button is at least 48 pixels tall, nothing is smaller than 18 pixels, and the whole site can be worked from the keyboard.

## Where to find it

Top right of every page, or in the menu on a phone. The full [accessibility statement](/accessibility) sets out what has been done and what has not.`,
  },
  {
    slug: "pin-it-to-the-noticeboard",
    title: "Pin it to the noticeboard",
    summary:
      "Fixture lists, tables, averages, the venue list and the roll of honour all print on plain paper, with the menus and buttons left off.",
    body: `Not everything belongs on a screen. A fixture list on the hall noticeboard is read by more people in a season than the page it came from.

So the pages that are worth printing have a **Print this page** button, and printing them gives you the thing itself — no menus, no navigation, no buttons, no dark background eating a cartridge.

You will find it on:

- the [fixture list](/fixtures) and the [season calendar](/fixtures/calendar)
- [match history](/results) and any team's fixtures
- the [league tables](/tables) and the [averages](/averages)
- the [club list](/clubs), a single club's details, and the [venue list](/venues)
- the [roll of honour](/honours)

Each one prints under its own heading, so a sheet on a noticeboard says what it is and which season it is for.

## Where to find it

Top right of any of those pages, next to the title.`,
  },
  {
    slug: "champions-back-to-1950",
    title: "Champions back to 1950",
    summary:
      "Seven hundred and twenty-five results across the league's competitions, from 1950 to last season, searchable by club, player, competition or year.",
    body: `The [roll of honour](/honours) holds **725** results, the earliest from **1950**.

Division champions, cup winners, the individual competitions — season by season, back through seventy-five years of the league. Much of it is recorded nowhere else at all; the paper it came from is long gone.

## Searchable

One box searches the lot. Type a club and see everything it has ever won. Type a name and see a career. Type **1974** and see that year. Type a competition and follow it through the decades.

It prints, too, which matters for a presentation night.

## And the rest of the archive

Alongside it sit the league's [newsletters](/newsletters), its [forms and documents](/documents) — constitution, handbook, scorecards — and [about the league](/about), which begins in 1936.

## Where to find it

**More**, then [Roll of honour](/honours).`,
  },
];
