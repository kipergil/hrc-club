// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import type { Season } from "@shared/types.js";
import { SeasonPicker } from "./season";

/** The league's real archive shape: a current season and fifteen behind it. */
function seasons(count = 16): Season[] {
  return Array.from({ length: count }, (_, index) => {
    const start = 2026 - index;
    return {
      id: String(start),
      label: `${start}-${String((start + 1) % 100).padStart(2, "0")}`,
      slug: `${start}-${String((start + 1) % 100).padStart(2, "0")}`,
      startsOn: null,
      endsOn: null,
      isCurrent: index === 0,
    };
  });
}

describe("the season picker", () => {
  it("shows the current season and hides the rest behind one button", () => {
    render(<SeasonPicker seasons={seasons()} value={undefined} onChange={() => {}} />);

    // The whole point: sixteen chips became one chip and one button.
    expect(screen.getByRole("button", { name: /2026-27 \(current season\)/ })).toBeTruthy();
    expect(screen.getByRole("button", { name: /Earlier seasons/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "2019-20" })).toBeNull();
  });

  it("lists every earlier season once opened", () => {
    render(<SeasonPicker seasons={seasons()} value={undefined} onChange={() => {}} />);

    fireEvent.click(screen.getByRole("button", { name: /Earlier seasons/ }));

    expect(screen.getByRole("button", { name: "2025-26" })).toBeTruthy();
    expect(screen.getByRole("button", { name: "2011-12" })).toBeTruthy();
    // The current season is not repeated inside — its chip is right there.
    expect(screen.queryByRole("button", { name: "2026-27" })).toBeNull();
  });

  it("reports the chosen season and closes", () => {
    const onChange = vi.fn();
    render(<SeasonPicker seasons={seasons()} value={undefined} onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /Earlier seasons/ }));
    fireEvent.click(screen.getByRole("button", { name: "2024-25" }));

    expect(onChange).toHaveBeenCalledWith("2024-25");
    expect(screen.queryByRole("button", { name: "2011-12" })).toBeNull();
  });

  it("clears the filter rather than naming the current season", () => {
    // `?season=2026-27` and no parameter are the same view, and the bare
    // URL is the one worth sharing.
    const onChange = vi.fn();
    render(<SeasonPicker seasons={seasons()} value="2024-25" onChange={onChange} />);

    fireEvent.click(screen.getByRole("button", { name: /2026-27 \(current season\)/ }));

    expect(onChange).toHaveBeenCalledWith(undefined);
  });

  it("puts the chosen season on the button, so it is never hidden", () => {
    render(<SeasonPicker seasons={seasons()} value="2018-19" onChange={() => {}} />);

    // Closed, but the control still says which year is being shown.
    expect(screen.getByRole("button", { name: /2018-19/ })).toBeTruthy();
    expect(screen.queryByRole("button", { name: /Earlier seasons/ })).toBeNull();
  });

  it("closes on Escape and gives focus back to the button", () => {
    render(<SeasonPicker seasons={seasons()} value={undefined} onChange={() => {}} />);

    const button = screen.getByRole("button", { name: /Earlier seasons/ });
    fireEvent.click(button);
    expect(button.getAttribute("aria-expanded")).toBe("true");

    fireEvent.keyDown(document, { key: "Escape" });

    // A popover you can open with the keyboard and not close with it is a trap.
    expect(button.getAttribute("aria-expanded")).toBe("false");
    expect(document.activeElement).toBe(button);
  });

  it("keeps a full name for screen readers while showing a short one", () => {
    render(<SeasonPicker seasons={seasons()} value={undefined} onChange={() => {}} />);

    // The visible word leans on the "Season" label and the chip beside it
    // for context. Announced alone, "Earlier" has none — so the accessible
    // name has to carry what the visible one drops.
    const button = screen.getByRole("button", { name: "Earlier seasons" });
    expect(button.textContent).toContain("Earlier");
    expect(button.textContent).not.toContain("Earlier seasons");
  });

  it("renders nothing when there is only one season to choose from", () => {
    const { container } = render(
      <SeasonPicker seasons={seasons(1)} value={undefined} onChange={() => {}} />,
    );
    expect(container.textContent).toBe("");
  });
});
