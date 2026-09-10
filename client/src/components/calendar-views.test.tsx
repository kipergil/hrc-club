// @vitest-environment jsdom
import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import type { CalendarWeek, Fixture } from "@shared/types.js";
import { buildCalendar, buildWeekBlocks } from "@/lib/calendar";
import { SeasonGrid, SeasonWeeks } from "./data";

/**
 * The two views of the season calendar.
 *
 * Both exist to say the one thing the league's own calendar does not: the
 * week a match is scheduled in and the evening it is played on are
 * different days, because the league schedules by week and each club plays
 * on its own night. On hertsttl.org.uk that date is inside a tooltip —
 * which is to say it is not there at all for anybody on a phone — and the
 * grid shows the Monday.
 *
 * So what is worth pinning here is not the markup but that: the real date
 * reaches the page in both views, and a cup or free week is named rather
 * than being an unexplained gap.
 */

let nextId = 0;
function fixture(
  week: string,
  playedOn: string | null,
  home: string,
  away: string,
  overrides: Partial<Fixture> = {},
): Fixture {
  const team = (name: string) => ({
    name,
    slug: name.toLowerCase().replace(/\s+/g, "-"),
    division: "premier" as const,
  });
  return {
    id: `f${(nextId += 1)}`,
    playedOn,
    startTime: null,
    weekCommencing: week,
    competition: "league",
    status: "scheduled",
    homeTeam: team(home),
    awayTeam: team(away),
    homeScore: null,
    awayScore: null,
    scorecardUrl: null,
    venueName: null,
    lastSyncedAt: null,
    ...overrides,
  };
}

function week(
  weekNumber: number,
  weekCommencing: string,
  kind: CalendarWeek["kind"] = "matches",
  label: string | null = null,
): CalendarWeek {
  return { weekNumber, weekCommencing, kind, label, note: null };
}

/**
 * Week 2 of 2026-27, as the league actually has it: three matches on two
 * different evenings inside one week that is named for Monday the 21st.
 */
const PROGRAMME = [
  fixture("2026-09-21", "2026-09-23", "HRC A", "Ellenborough A"),
  fixture("2026-09-21", "2026-09-25", "Ellenborough A", "Cheshunt A"),
];
const WEEKS = [
  week(1, "2026-09-14", "cup", "Divisional"),
  week(2, "2026-09-21"),
  week(3, "2026-09-28", "free", "Free"),
];

describe("the season grid", () => {
  it("shows the evening a match is played, not only the week it is in", () => {
    // The whole failure this replaces: the header says Monday 21 September
    // and the match is on Wednesday the 23rd. A reader who took the header
    // at its word would turn up two days early at a hall that is shut.
    render(<SeasonGrid segments={buildCalendar(PROGRAMME, WEEKS)} />);

    const table = screen.getByRole("table");
    expect(within(table).getAllByText("Wed 23 Sep").length).toBeGreaterThan(0);
    expect(within(table).getAllByText("Fri 25 Sep").length).toBeGreaterThan(0);
  });

  it("names a cup week in its own column header", () => {
    render(<SeasonGrid segments={buildCalendar(PROGRAMME, WEEKS)} />);

    const header = screen.getByRole("columnheader", { name: /Mon 14 Sep/ });
    // The league spells "DivCup" vertically down the rows a letter at a
    // time. Once, in the header, in words.
    expect(header.textContent).toContain("Divisional cup");
  });

  it("names a free week rather than leaving a blank fortnight", () => {
    render(<SeasonGrid segments={buildCalendar(PROGRAMME, WEEKS)} />);
    expect(screen.getByRole("columnheader", { name: /Mon 28 Sep/ }).textContent).toContain(
      "Free week",
    );
  });

  it("keeps a column for a week nobody plays in", () => {
    // Built from fixtures alone the season has one column. The point of
    // reading the league's calendar is the other two.
    render(<SeasonGrid segments={buildCalendar(PROGRAMME, WEEKS)} />);
    expect(screen.getAllByRole("columnheader")).toHaveLength(4); // "Team" plus three weeks
  });

  it("says home and away in words, not by italicising one of them", () => {
    // The league's own page italicises away fixtures and explains that it
    // does in a line at the top. That is styling carrying meaning alone.
    render(<SeasonGrid segments={buildCalendar(PROGRAMME, WEEKS)} />);
    const rowFor = (name: string) =>
      screen
        .getAllByRole("row")
        .find((row) => within(row).queryByRole("rowheader")?.textContent === name)!;

    // HRC A host Ellenborough on the 23rd; Ellenborough then host Cheshunt
    // on the 25th, so the same week reads "v" on one row and "at" on
    // another with nothing but the word to tell them apart.
    expect(rowFor("HRC A").textContent).toContain("v Ellenborough A");
    expect(rowFor("Cheshunt A").textContent).toContain("at Ellenborough A");
  });
});

describe("the week-by-week view", () => {
  it("heads each night with the full date and gathers its matches under it", () => {
    render(<SeasonWeeks blocks={buildWeekBlocks(PROGRAMME, WEEKS)} />);

    // Written out. This view exists so the date cannot be skimmed past.
    expect(screen.getByText("Wednesday 23 September 2026")).toBeTruthy();
    expect(screen.getByText("Friday 25 September 2026")).toBeTruthy();
  });

  it("gives the week its number and its Monday, and does not confuse the two", () => {
    render(<SeasonWeeks blocks={buildWeekBlocks(PROGRAMME, WEEKS)} />);
    const heading = screen.getByRole("heading", { name: /Week 2/ });
    expect(heading.textContent).toContain("commencing Mon 21 Sep");
  });

  it("explains a free week instead of showing an empty block", () => {
    render(<SeasonWeeks blocks={buildWeekBlocks(PROGRAMME, WEEKS)} />);
    // A free week is not a week the league forgot: it is where a postponed
    // match goes, which is the one thing worth saying about it.
    expect(screen.getByText(/Outstanding matches can be played/)).toBeTruthy();
  });

  it("labels a cup week", () => {
    render(<SeasonWeeks blocks={buildWeekBlocks(PROGRAMME, WEEKS)} />);
    expect(screen.getByText("Divisional cup")).toBeTruthy();
  });

  it("names the teams with no match in a week the rest are playing", () => {
    render(
      <SeasonWeeks
        blocks={buildWeekBlocks(
          [...PROGRAMME, fixture("2026-09-28", "2026-09-30", "Kidston", "HRC B")],
          [week(2, "2026-09-21"), week(3, "2026-09-28")],
        )}
      />,
    );
    expect(screen.getByText(/No match this week: HRC A, Ellenborough A, Cheshunt A/)).toBeTruthy();
  });

  it("links a played match to its card", () => {
    render(
      <SeasonWeeks
        blocks={buildWeekBlocks(
          [
            fixture("2026-09-21", "2026-09-23", "HRC A", "Kidston", {
              status: "played",
              homeScore: 7,
              awayScore: 3,
              id: "played-1",
            }),
          ],
          [week(2, "2026-09-21")],
        )}
      />,
    );
    const link = screen.getByRole("link", { name: "7–3" });
    expect(link.getAttribute("href")).toBe("/results/played-1");
  });

  it("says so plainly when a division has no programme yet", () => {
    render(<SeasonWeeks blocks={[]} />);
    expect(screen.getByText(/no fixture programme for this division yet/)).toBeTruthy();
  });
});

describe("what the league's own labels are called here", () => {
  /**
   * The league's three are "Divisional", "Handicap" and "Finals". Two of
   * them take "cup" after them and the third does not: nobody in this
   * league says "Finals cup".
   */
  it.each([
    ["Divisional", "Divisional cup"],
    ["Handicap", "Handicap cup"],
    ["Finals", "Cup finals"],
  ])("calls a %s week %s", (label, expected) => {
    render(
      <SeasonWeeks
        blocks={buildWeekBlocks(
          [fixture("2026-09-21", "2026-09-23", "HRC A", "Kidston")],
          [week(1, "2026-09-14", "cup", label), week(2, "2026-09-21")],
        )}
      />,
    );
    expect(screen.getByText(expected)).toBeTruthy();
  });

  it("still names a cup week the league left unlabelled", () => {
    render(
      <SeasonWeeks
        blocks={buildWeekBlocks(
          [fixture("2026-09-21", "2026-09-23", "HRC A", "Kidston")],
          [week(1, "2026-09-14", "cup", null), week(2, "2026-09-21")],
        )}
      />,
    );
    expect(screen.getByText("Cup week")).toBeTruthy();
  });
});
