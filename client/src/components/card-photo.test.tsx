// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { CardPhoto } from "./card-photo";

/**
 * Checking a read card is a comparison, and a comparison needs both
 * things. The photograph used to unmount the moment the draft arrived,
 * leaving the reviewer confirming forty-odd numbers against a card they
 * could no longer see.
 *
 * Dragging itself is a pointer-capture gesture that jsdom does not model,
 * and is checked against a real browser instead — 200px of travel at 200%.
 * What is worth pinning here is everything around it: that the enlarged
 * view opens and closes, that it can be worked without a mouse, and that
 * it puts the page back the way it found it.
 */

afterEach(() => {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

const SRC = "blob:http://localhost/a-photograph";

describe("the photographed card", () => {
  it("is a button, so it can be opened without a mouse", () => {
    // An <img> with a click handler is invisible to the keyboard and
    // announces itself as an image rather than as something that does
    // something.
    render(<CardPhoto src={SRC} />);
    expect(screen.getByRole("button", { name: /Enlarge/ })).toBeTruthy();
  });

  it("opens the enlarged view as a dialog", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));

    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.querySelector("img")?.getAttribute("src")).toBe(SRC);
  });

  it("holds the page still while it is open, and lets go afterwards", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));
    expect(document.documentElement.style.overflow).toBe("hidden");

    fireEvent.keyDown(document, { key: "Escape" });

    // Left locked, the reviewer would come back to a form they could not
    // scroll — and nothing on screen to say why.
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes on the Close button as well as on Escape", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("zooms with the buttons and says how far in it is", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));
    expect(screen.getByRole("dialog").textContent).toContain("100%");

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    // "Am I zoomed in?" is otherwise only answerable by dragging and
    // seeing whether anything moves.
    expect(screen.getByRole("dialog").textContent).toContain("200%");
  });

  it("cannot be zoomed out past the whole card", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));

    const out = screen.getByRole("button", { name: "Zoom out" });
    // Disabled at 1×, so there is no way to end up looking at a card
    // smaller than the space available for it.
    expect(out.hasAttribute("disabled")).toBe(true);
  });

  it("re-centres when it is zoomed back out", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));
    const image = () => screen.getByRole("dialog").querySelector("img")!;

    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));
    fireEvent.keyDown(document, { key: "ArrowRight" });
    expect(image().style.transform).not.toContain("translate(0px, 0px)");

    fireEvent.click(screen.getByRole("button", { name: "Zoom out" }));

    // A card left panned off-screen at 1× reads as a broken viewer.
    expect(image().style.transform).toContain("translate(0px, 0px)");
  });

  it("can be panned from the keyboard", () => {
    render(<CardPhoto src={SRC} />);
    fireEvent.click(screen.getByRole("button", { name: /Enlarge/ }));
    fireEvent.click(screen.getByRole("button", { name: "Zoom in" }));

    const before = screen.getByRole("dialog").querySelector("img")!.style.transform;
    fireEvent.keyDown(document, { key: "ArrowDown" });

    // Dragging is the gesture most people will use; it must not be the
    // only one that reaches the bottom of the card.
    expect(screen.getByRole("dialog").querySelector("img")!.style.transform).not.toBe(before);
  });

  it("offers to remove the photograph only when there is something to do about it", () => {
    const onRemove = vi.fn();
    const { rerender } = render(<CardPhoto src={SRC} />);
    expect(screen.queryByRole("button", { name: /Remove/ })).toBeNull();

    rerender(<CardPhoto src={SRC} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole("button", { name: /Remove/ }));
    expect(onRemove).toHaveBeenCalled();
  });
});
