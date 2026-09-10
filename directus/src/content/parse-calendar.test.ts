import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { addDays, parseCalendar, type SeasonCalendar } from "./parse-calendar.js";

/**
 * The captured copies are the league's own `Calendar0/1/2.htm` and the
 * `CalendarJ*.js` each of them loads, saved on 10 September 2026.
 *
 * The page is Windows-1252, like the rest of that site — read as UTF-8 the
 * team names come out mangled, and "St. Andrews" is close enough to right
 * that nobody would notice until a name failed to match a row in Directus.
 */
function load(division: 0 | 1 | 2): SeasonCalendar {
  const at = (name: string) => fileURLToPath(new URL(`./__fixtures__/${name}`, import.meta.url));
  return parseCalendar(
    new TextDecoder("windows-1252").decode(readFileSync(at(`calendar${division}.htm`))),
    readFileSync(at(`calendar${division}.js`), "utf8"),
  );
}

describe("addDays", () => {
  it("crosses a month, a year and the end of British Summer Time", () => {
    expect(addDays("2026-09-28", 4)).toBe("2026-10-02");
    expect(addDays("2026-12-28", 7)).toBe("2027-01-04");
    // The clocks go back on 25 October 2026. Done in local time this lands
    // on the 25th, an hour short of the day it should be.
    expect(addDays("2026-10-19", 7)).toBe("2026-10-26");
  });
});

describe("reading the season's shape", () => {
  it("takes the start date and the season from the page, not from today", () => {
    const premier = load(0);
    expect(premier.seasonStart).toBe("2026-09-14");
    expect(premier.seasonLabel).toBe("2026-27");
  });

  it("finds every team and the night it plays at home", () => {
    const premier = load(0);
    expect(premier.teams).toHaveLength(8);
    // 1 = Monday. Grundy Park play Mondays, Cheshunt Tuesdays, the three
    // Hertford clubs Wednesdays, Ellenborough Fridays — which is the whole
    // reason a week and a match date are different things.
    expect(premier.homeNights["Grundy Park A"]).toBe(1);
    expect(premier.homeNights["Cheshunt A"]).toBe(2);
    expect(premier.homeNights["HRC A"]).toBe(3);
    expect(premier.homeNights["Ellenborough A"]).toBe(5);
  });

  it("leaves the league's 'No Match' padding out of the team list", () => {
    // Division 2 has nine teams, so the league pads the grid to ten and
    // gives one side a bye each week. Taken as a team it would appear in
    // the calendar, in Directus, and in a fixture nobody plays.
    const two = load(2);
    expect(two.teams).toHaveLength(9);
    expect(two.teams).not.toContain("No Match");
    expect(two.fixtures.some((f) => f.homeTeam === "No Match" || f.awayTeam === "No Match")).toBe(
      false,
    );
  });
});

describe("the two dates", () => {
  it("puts a match on the host's night, not on the Monday", () => {
    const premier = load(0);
    // Cheshunt A away to Ellenborough A in week 3. The league's own tooltip
    // for that cell reads "Friday Oct 2nd" — the week commences Monday the
    // 28th of September and Ellenborough play Fridays.
    const away = premier.fixtures.find(
      (f) => f.week === 3 && f.homeTeam === "Ellenborough A" && f.awayTeam === "Cheshunt A",
    );
    expect(away).toBeTruthy();
    expect(away!.weekCommencing).toBe("2026-09-28");
    expect(away!.playedOn).toBe("2026-10-02");
  });

  it("reads the row's own team as the away side when the cell says away", () => {
    // `Match('A','I','a',…)` is on Cheshunt A's row: A is Cheshunt, I is
    // Ellenborough, and `a` means Cheshunt are away. Reading `a` as the
    // home team gives Cheshunt a fixture against themselves — which is
    // exactly what the first pass at this did, and it parsed cleanly.
    const premier = load(0);
    for (const fixture of premier.fixtures) {
      expect(fixture.homeTeam).not.toBe(fixture.awayTeam);
    }
  });

  it("counts each fixture once, though it appears on both teams' rows", () => {
    // Eight teams playing each other home and away is 56, and every one of
    // them is drawn twice in the grid.
    expect(load(0).fixtures).toHaveLength(56);
    expect(load(1).fixtures).toHaveLength(56);
    // Nine teams, so 9 × 8.
    expect(load(2).fixtures).toHaveLength(72);
  });

  it("gives every fixture a played date inside its own week", () => {
    for (const division of [0, 1, 2] as const) {
      for (const fixture of load(division).fixtures) {
        const offset =
          (Date.parse(fixture.playedOn) - Date.parse(fixture.weekCommencing)) / 86_400_000;
        expect(offset, `${fixture.homeTeam} v ${fixture.awayTeam}`).toBeGreaterThanOrEqual(0);
        expect(offset).toBeLessThanOrEqual(6);
      }
    }
  });
});

describe("weeks that are not match weeks", () => {
  it("reads all thirty-two weeks of the season", () => {
    for (const division of [0, 1, 2] as const) {
      const weeks = load(division).weeks;
      expect(weeks).toHaveLength(32);
      expect(weeks.map((w) => w.week)).toEqual([...Array(32)].map((_, i) => i + 1));
    }
  });

  it("names the cup rounds the league runs", () => {
    const cups = load(0).weeks.filter((w) => w.kind === "cup");
    expect(cups).toHaveLength(9);
    expect(new Set(cups.map((w) => w.label))).toEqual(
      new Set(["Divisional", "Handicap", "Finals"]),
    );
    // The season opens on a cup week: the first league match is week 2.
    expect(load(0).weeks[0]).toMatchObject({ week: 1, kind: "cup", label: "Divisional" });
  });

  it("marks the free weeks, Christmas included", () => {
    const free = load(0).weeks.filter((w) => w.kind === "free");
    expect(free).toHaveLength(5);
    // Weeks 15 and 16 commence 21 and 28 December.
    expect(free.map((w) => w.weekCommencing)).toContain("2026-12-21");
    expect(free.map((w) => w.weekCommencing)).toContain("2026-12-28");
  });

  it("calls a week with matches in it a match week, byes and all", () => {
    // Division 2's odd team out is marked with the same `Break(...)` handler
    // as a genuine free week. Taking the first cell of a column at its word
    // would empty an entire round of fixtures out of the calendar.
    const two = load(2);
    const playing = new Set(two.fixtures.map((f) => f.week));
    for (const week of two.weeks) {
      if (playing.has(week.week)) expect(week.kind).toBe("matches");
      else expect(week.kind).not.toBe("matches");
    }
  });

  it("agrees on the season's shape across all three divisions", () => {
    // The league runs one programme; the divisions differ only in who is
    // playing. A division whose free weeks fell elsewhere would mean the
    // grid had been read against the wrong script.
    const shape = (c: SeasonCalendar) => c.weeks.map((w) => `${w.week}:${w.kind}`).join(" ");
    expect(shape(load(1))).toBe(shape(load(0)));
    expect(shape(load(2))).toBe(shape(load(0)));
  });
});
