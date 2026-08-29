import { describe, expect, it } from "vitest";
import { formatTime, resultLabel } from "./utils";

describe("formatTime", () => {
  it("writes a club night the way a noticeboard would", () => {
    expect(formatTime("19:30:00")).toBe("7.30pm");
    expect(formatTime("20:00:00")).toBe("8pm");
    expect(formatTime("09:15:00")).toBe("9.15am");
  });

  it("handles midnight and noon without saying 0pm", () => {
    expect(formatTime("00:30:00")).toBe("12.30am");
    expect(formatTime("12:00:00")).toBe("12pm");
  });

  it("returns nothing for a missing time rather than a stray dash", () => {
    expect(formatTime(null)).toBe("");
    expect(formatTime(undefined)).toBe("");
  });
});

describe("resultLabel", () => {
  /**
   * The reason this function exists at all: colour is never the only signal
   * on this site, so every result has to have a word.
   */
  it("gives every state a word", () => {
    expect(resultLabel("win", "played")).toBe("Won");
    expect(resultLabel("loss", "played")).toBe("Lost");
    expect(resultLabel("draw", "played")).toBe("Drawn");
    expect(resultLabel(null, "scheduled")).toBe("To play");
    expect(resultLabel(null, "postponed")).toBe("Postponed");
    expect(resultLabel(null, "cancelled")).toBe("Cancelled");
  });

  it("lets the status override a stale result on a voided match", () => {
    expect(resultLabel("win", "void")).toBe("Void");
  });
});
