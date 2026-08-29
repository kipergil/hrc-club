// @vitest-environment jsdom
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { Fixture, Standing } from "@shared/types.js";
import { FixtureList, StandingsTable } from "./data";

function fixture(overrides: Partial<Fixture> = {}): Fixture {
  return {
    id: "f1",
    playedOn: "2026-09-15",
    startTime: "19:30:00",
    weekCommencing: "2026-09-14",
    competition: "league",
    opponentName: "Water Lane A",
    isHome: true,
    status: "played",
    result: "win",
    hrcScore: 7,
    opponentScore: 3,
    scorecardUrl: null,
    teamName: "HRC A",
    teamSlug: "hrc-a",
    venueName: "HRC main hall",
    lastSyncedAt: null,
    ...overrides,
  };
}

function standing(overrides: Partial<Standing> = {}): Standing {
  return {
    id: "s1",
    division: "premier",
    position: 2,
    teamName: "HRC A",
    isHrc: true,
    played: 3,
    won: 2,
    drawn: 0,
    lost: 1,
    setsFor: 18,
    setsAgainst: 12,
    points: 4,
    lastSyncedAt: null,
    ...overrides,
  };
}

/**
 * These are accessibility regression tests, not rendering tests. Each one
 * pins a rule from the PRD that is easy to undo by accident while making
 * something look tidier.
 */
describe("FixtureList", () => {
  it("says whether we won in words, not only in colour", () => {
    render(<FixtureList fixtures={[fixture()]} showResult emptyMessage="none" />);
    expect(screen.getAllByText("Won").length).toBeGreaterThan(0);
  });

  it("says home or away in words", () => {
    render(<FixtureList fixtures={[fixture({ isHome: false })]} emptyMessage="none" />);
    expect(screen.getAllByText("away").length).toBeGreaterThan(0);
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
});
