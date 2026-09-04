// @vitest-environment jsdom
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { READING_LINES, ReadingProgress } from "./reading-progress";

/**
 * The wait used to be a button that said "Reading the card…" and nothing
 * else, which for half a minute is indistinguishable from a page that has
 * stopped working — so people pressed the button again, or decided the
 * upload had been cancelled.
 *
 * What has to hold: something changes, and a screen reader is told once
 * rather than every three and a half seconds.
 */

describe("the wait while a card is read", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("says one calm thing in the live region", () => {
    render(<ReadingProgress />);

    const status = screen.getByRole("status");
    expect(status.textContent).toContain("Reading the card");
    // No percentage and no stage: the wait has neither, and inventing one
    // is worse than admitting it.
    expect(status.textContent).not.toMatch(/\d+\s*%/);
  });

  it("keeps the jokes out of the live region", () => {
    /*
     * The rotating line is decorative. Announced, it would read out a new
     * sentence every few seconds for the length of the wait, which is
     * actively worse than silence.
     */
    const { container } = render(<ReadingProgress />);

    const line = [...container.querySelectorAll('[aria-hidden="true"]')].map((n) => n.textContent);
    expect(line.some((text) => READING_LINES.includes(text as never))).toBe(true);
    expect(screen.getByRole("status").getAttribute("aria-hidden")).toBeNull();
  });

  it("changes what it says, so the page is visibly still alive", () => {
    const { container } = render(<ReadingProgress intervalMs={1000} />);
    const shown = () =>
      [...container.querySelectorAll('[aria-hidden="true"]')]
        .map((n) => n.textContent ?? "")
        .find((text) => READING_LINES.includes(text as never));

    const first = shown();
    act(() => void vi.advanceTimersByTime(1000));
    expect(shown()).not.toBe(first);
  });

  it("admits it is taking a while, rather than leaving people guessing", () => {
    render(<ReadingProgress reassureAfterMs={5000} />);
    expect(screen.queryByText(/Still going/)).toBeNull();

    act(() => void vi.advanceTimersByTime(5000));

    // At forty seconds "has this hung?" is the actual question being asked,
    // and answering it is the whole job of this line.
    expect(screen.getByText(/Still going/)).toBeTruthy();
    expect(screen.getByText(/nothing is saved until you check it/)).toBeTruthy();
  });

  it("stops its timers when it goes away", () => {
    // The component unmounts the instant a draft arrives, and a timer left
    // running would set state on it for the rest of the session.
    const { unmount } = render(<ReadingProgress intervalMs={1000} />);
    unmount();
    expect(() => act(() => void vi.advanceTimersByTime(10_000))).not.toThrow();
  });
});
