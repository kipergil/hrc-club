import { describe, expect, it } from "vitest";
import { teamFixturesHref, teamHref, teamModuleHref } from "./links.js";

describe("where a team name goes", () => {
  it("keeps a played match in the results module", () => {
    expect(teamModuleHref("water-lane-a", "played")).toBe("/results?team=water-lane-a");
  });

  it("keeps an unplayed match in the fixtures module", () => {
    expect(teamModuleHref("water-lane-a", "scheduled")).toBe("/fixtures?team=water-lane-a");
  });

  it("treats anything not yet played as a fixture", () => {
    // A postponed or cancelled match has not produced a result, so the
    // place to see it is still the calendar.
    expect(teamModuleHref("hrc-b", "postponed")).toBe("/fixtures?team=hrc-b");
  });

  it("carries the season the reader was looking at", () => {
    // Clicking a team while filtered to 2024-25 and landing on the current
    // season would silently undo the filter.
    expect(teamModuleHref("hrc-b", "played", "2024-25")).toBe(
      "/results?team=hrc-b&season=2024-25",
    );
  });

  it("escapes anything a slug or season could carry", () => {
    expect(teamModuleHref("st-andrews-a", "played", "2024/25")).toBe(
      "/results?team=st-andrews-a&season=2024%2F25",
    );
  });
});

describe("the team's own page", () => {
  it("is the plain path when no season is in play", () => {
    expect(teamHref("hrc-b")).toBe("/teams/hrc-b");
  });

  it("keeps the season, because a team's row exists once per season", () => {
    expect(teamHref("hrc-b", "2024-25")).toBe("/teams/hrc-b?season=2024-25");
  });
});

describe("teamFixturesHref", () => {
  it("is the fixtures module regardless of any match's status", () => {
    expect(teamFixturesHref("kidston-a")).toBe("/fixtures?team=kidston-a");
    expect(teamFixturesHref("kidston-a", "2025-26")).toBe(
      "/fixtures?team=kidston-a&season=2025-26",
    );
  });
});
