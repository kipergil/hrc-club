// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Fixture, Standing, TeamFixture } from "@shared/types.js";
import { FixtureList, StandingsTable, TeamFixtureList } from "./data";

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: "f1",
    playedOn: "2026-09-15",
    startTime: "19:30:00",
    weekCommencing: "2026-09-14",
    competition: "league",
    status: "played",
    homeTeam: { name: "HRC A", slug: "hrc-a", division: "premier" },
    awayTeam: { name: "Water Lane A", slug: "water-lane-a", division: "premier" },
    homeScore: 7,
    awayScore: 3,
    scorecardUrl: null,
    venueName: "HRC main hall",
    lastSyncedAt: null,
    ...overrides,
  };
}

/** The same match as one of the two teams sees it. */
function teamFixture(overrides: Partial<TeamFixture> = {}): TeamFixture {
  const base = fixture();
  return {
    ...base,
    isHome: true,
    opponent: base.awayTeam,
    teamScore: 7,
    opponentScore: 3,
    result: "win",
    ...overrides,
  };
}

function standing(overrides: Partial<Standing> = {}): Standing {
  return {
    id: "s1",
    division: "premier",
    position: 2,
    teamName: "HRC A",
    teamSlug: "hrc-a",
    isHrc: true,
    played: 3,
    won: 2,
    drawn: 0,
    lost: 1,
    setsFor: 18,
    setsAgainst: 12,
    points: 4,
    seasonIncomplete: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

/** A row as the league's archived tables have it: played and points only. */
function archivedStanding(overrides: Partial<Standing> = {}): Standing {
  return standing({
    won: null,
    drawn: null,
    lost: null,
    setsFor: null,
    setsAgainst: null,
    ...overrides,
  });
}

/**
 * These are accessibility regression tests, not rendering tests. Each one
 * pins a rule from the PRD that is easy to undo by accident while making
 * something look tidier.
 */
describe("FixtureList", () => {
  it("names both teams, because neither side of a league match is 'us'", () => {
    render(<FixtureList fixtures={[fixture()]} emptyMessage="none" />);
    expect(screen.getAllByText("HRC A").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Water Lane A").length).toBeGreaterThan(0);
  });

  it("does not print a scoreline for a match nobody has played", () => {
    // 0–0 is a result somebody played for; an unplayed match has none.
    render(
      <FixtureList
        fixtures={[fixture({ status: "scheduled", homeScore: null, awayScore: null })]}
        emptyMessage="none"
      />,
    );
    expect(screen.queryByText("0–0")).toBeNull();
  });

  it("names the cup when a match is not a league match", () => {
    render(
      <FixtureList
        fixtures={[fixture({ competition: "creasey_cup" })]}
        emptyMessage="none"
      />,
    );
    expect(screen.getAllByText(/Creasey Cup/).length).toBeGreaterThan(0);
  });

  it("explains an empty list rather than saying 'no results'", () => {
    render(<FixtureList fixtures={[]} emptyMessage="No matches left in the calendar." />);
    expect(screen.getByText("No matches left in the calendar.")).toBeDefined();
  });
});

describe("TeamFixtureList", () => {
  it("says whether the team won in words, not only in colour", () => {
    render(<TeamFixtureList fixtures={[teamFixture()]} emptyMessage="none" />);
    expect(screen.getAllByText("Won").length).toBeGreaterThan(0);
  });

  it("says home or away in words", () => {
    render(
      <TeamFixtureList
        fixtures={[teamFixture({ isHome: false })]}
        emptyMessage="none"
      />,
    );
    expect(screen.getAllByText(/away/).length).toBeGreaterThan(0);
  });

  it("puts the team's own score first, whichever side of the match they were", () => {
    /*
     * The away side of a 7–3 home win lost 3–7. Reading the stored score
     * straight through would tell half the league they won matches they
     * lost.
     */
    const base = fixture();
    render(
      <TeamFixtureList
        fixtures={[
          teamFixture({
            isHome: false,
            opponent: base.homeTeam,
            teamScore: 3,
            opponentScore: 7,
            result: "loss",
          }),
        ]}
        emptyMessage="none"
      />,
    );
    expect(screen.getAllByText("3–7").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Lost").length).toBeGreaterThan(0);
  });
});

describe("StandingsTable", () => {
  it("marks the home club's rows with a label, not just a background colour", () => {
    // The tinted row is `bg-brand-soft` and nothing else, so without the
    // badge this table signals membership by colour alone. It has already
    // regressed once, when the site was reframed from one club's to the
    // league's and the label — then hardcoded to "HRC" — was dropped along
    // with the rest of the club framing.
    render(<StandingsTable standings={[standing()]} />);
    expect(screen.getAllByText("Your club").length).toBeGreaterThan(0);
  });

  it("leaves every other row unmarked", () => {
    render(<StandingsTable standings={[standing({ isHrc: false })]} />);
    expect(screen.queryByText("Your club")).toBeNull();
  });

  it("carries a plain-English explanation above the table", () => {
    render(<StandingsTable standings={[standing()]} />);
    expect(screen.getByText(/Most points at the top/)).toBeDefined();
  });

  it("renders a real table for screen readers and keyboard users", () => {
    render(<StandingsTable standings={[standing()]} />);
    expect(screen.getByRole("table")).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Points" })).toBeDefined();
  });

  it("never prints a zero for a win the archive does not record", () => {
    /*
     * The league's closing tables, back to 2011-12, carry team, played and
     * points and nothing else. Defaulting the rest to zero would have this
     * table state that the champions won no matches — a claim the source
     * never made. The column comes out instead.
     */
    render(<StandingsTable standings={[archivedStanding({ played: 14, points: 118 })]} />);
    expect(screen.queryByRole("columnheader", { name: "Won" })).toBeNull();
    expect(screen.queryByRole("columnheader", { name: "Lost" })).toBeNull();
    expect(screen.getByRole("columnheader", { name: "Played" })).toBeDefined();
    expect(screen.getByRole("columnheader", { name: "Points" })).toBeDefined();
  });

  it("says so, in words, when the table is the league's own closing one", () => {
    render(<StandingsTable standings={[archivedStanding()]} />);
    expect(screen.getByText(/played and points only/)).toBeDefined();
  });

  it("keeps the full record when the season's results are held here", () => {
    render(<StandingsTable standings={[standing()]} />);
    expect(screen.getByRole("columnheader", { name: "Won" })).toBeDefined();
    expect(screen.queryByText(/played and points only/)).toBeNull();
  });

  it("keeps the win column when only some teams have yet to play", () => {
    // A division at the start of a season has rows with a real zero in it.
    // Those are known zeroes, and dropping the column for them would lose
    // the very thing the table is for.
    render(<StandingsTable standings={[standing({ won: 0 }), standing({ id: "s2", won: 2 })]} />);
    expect(screen.getByRole("columnheader", { name: "Won" })).toBeDefined();
  });

  it("marks a season the league never finished", () => {
    render(<StandingsTable standings={[archivedStanding({ seasonIncomplete: "abandoned" })]} />);
    expect(screen.getByText(/abandoned part-way through/i)).toBeDefined();
  });

  it("leaves an ordinary season unmarked", () => {
    render(<StandingsTable standings={[standing()]} />);
    expect(screen.queryByText(/abandoned/i)).toBeNull();
    expect(screen.queryByText(/cancelled/i)).toBeNull();
  });
});
