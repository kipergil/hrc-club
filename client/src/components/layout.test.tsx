// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Layout } from "./layout";

// jsdom has no media queries; the theme toggle asks it for the system
// preference on mount.
beforeAll(() => {
  vi.stubGlobal("matchMedia", (query: string) => ({
    matches: false,
    media: query,
    addEventListener() {},
    removeEventListener() {},
  }));
});

/**
 * Two reports from the same reader, and one cause behind each: on a long
 * page there was no way back to the navigation.
 *
 * `<main>` starts below the header, so the footer's "Back to top" landed on
 * the breadcrumb with the whole masthead off the top of the screen. And the
 * menu panel hangs off the header, which scrolls — so opening the menu and
 * flicking the screen sent it off the top while the page slid past
 * underneath, leaving the button reporting a menu that was nowhere to be
 * seen.
 *
 * Neither shows up in a render: both are about where the page is, which is
 * why the checks below are about scroll rather than about markup.
 */

function renderSite(pathname = "/results") {
  // Any page but the home page: the footer's navigation, "Back to top"
  // included, is furniture on the one page it would point at itself.
  window.history.pushState({}, "", pathname);
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return render(
    <QueryClientProvider client={client}>
      <Layout>
        <p>A very long fixture list.</p>
      </Layout>
    </QueryClientProvider>,
  );
}

afterEach(() => {
  // A lock left on outlives the test that set it, and the next failure
  // would look like it came from somewhere else.
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
  document.body.style.paddingRight = "";
});

describe("getting back to the navigation", () => {
  it("points 'Back to top' at the header, not at the content below it", () => {
    renderSite();

    const link = screen.getByRole("link", { name: "Back to top" });
    const target = link.getAttribute("href")!.slice(1);

    // The id has to be on the header itself. Pointed at `#main` — the old
    // value, and still the right one for the skip link — this stops at the
    // breadcrumb with the menu above the fold.
    expect(document.getElementById(target)?.tagName).toBe("HEADER");
  });

  it("keeps the skip link aimed past the navigation", () => {
    renderSite();

    // The mirror image of the above: this one is *supposed* to jump the
    // header, and fixing the other must not quietly change it.
    expect(screen.getByRole("link", { name: /Skip to the main content/ }).getAttribute("href")).toBe(
      "#main",
    );
  });
});

describe("the phone menu", () => {
  it("holds the page still while it is open, and lets go afterwards", () => {
    renderSite();
    const menu = screen.getByRole("button", { name: "Menu" });

    expect(document.documentElement.style.overflow).toBe("");

    fireEvent.click(menu);
    // Without this the first flick carries the open menu off the top of
    // the screen along with the header it is anchored to.
    expect(document.documentElement.style.overflow).toBe("hidden");
    expect(document.body.style.overflow).toBe("hidden");

    fireEvent.click(menu);
    expect(document.documentElement.style.overflow).toBe("");
    expect(document.body.style.overflow).toBe("");
  });

  it("releases the page when it closes on Escape", () => {
    renderSite();

    fireEvent.click(screen.getByRole("button", { name: "Menu" }));
    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("button", { name: "Menu" })?.getAttribute("aria-expanded")).toBe(
      "false",
    );
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("closes when the page behind it is tapped", () => {
    // With the page held still, a reader who opened this by accident and
    // did not spot the X would otherwise be looking at a frozen site.
    renderSite();
    const menu = screen.getByRole("button", { name: "Menu" });

    fireEvent.click(menu);
    const backdrop = document.querySelector("#mobile-menu")!.previousElementSibling!;
    fireEvent.click(backdrop);

    expect(menu.getAttribute("aria-expanded")).toBe("false");
    expect(document.documentElement.style.overflow).toBe("");
  });

  it("stops a flick inside the list from scrolling the page behind it", () => {
    renderSite();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const list = document.querySelector("#mobile-menu > div")!;
    expect(list.className).toContain("overscroll-contain");
  });
});

describe("printing", () => {
  /**
   * The button used to sit beside each page's title — the wrong end of a
   * page somebody prints *after* reading it. It is now in the footer
   * navigation beside Back and Home, which means `Layout` decides whether
   * to show it rather than the page passing it down.
   */
  it("offers Print at the foot of a page worth printing", () => {
    renderSite("/tables");

    const print = screen.getByRole("button", { name: /Print/ });
    expect(print.textContent).toContain("Print");
    // The accessible name has to contain the visible one, or a voice
    // control user saying "Print" hits nothing.
    expect(print.getAttribute("aria-label")).toContain("Print");

    // In the page-navigation row, not floating somewhere else.
    expect(print.closest("nav")?.getAttribute("aria-label")).toBe("Page navigation");
  });

  it("leaves it off a page nobody would print", () => {
    renderSite("/contact");
    expect(screen.queryByRole("button", { name: /Print/ })).toBeNull();
  });

  it("keeps every button in the row a full touch target", () => {
    // The row was narrowed to fit on one line. `min-h-touch` is the 48px
    // this site is built to and is not what gives — most of its readers
    // are the wrong side of sixty.
    renderSite("/tables");

    const row = screen.getByRole("navigation", { name: "Page navigation" });
    const controls = [...row.querySelectorAll("a, button")];
    expect(controls.length).toBeGreaterThanOrEqual(4);
    for (const control of controls) {
      // "Back to top" is a plain text link, not one of the buttons.
      if (control.textContent?.trim() === "Back to top") continue;
      expect(control.className, `${control.textContent?.trim()} lost its touch target`).toContain(
        "min-h-touch",
      );
    }
  });
});
