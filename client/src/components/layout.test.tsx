// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
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

describe("the phone menu's display controls", () => {
  /**
   * These went missing in Chrome on a phone. The panel was `70vh` of list
   * plus a row of controls beneath it, and Chrome reports `100vh` as the
   * large viewport — the height with the URL bar retracted — while the
   * visible area is about 110px shorter whenever that bar shows. The
   * controls sat below the fold, and with the page behind deliberately
   * locked nothing could scroll to reach them.
   *
   * jsdom lays nothing out, so the geometry was measured in a browser at
   * four phone sizes with the visible area shortened. What is worth
   * pinning here is the mechanism, because it is the part that would be
   * quietly undone by someone "simplifying" it back to a CSS height.
   */
  const withVisualViewport = (height: number) => {
    const listeners = { addEventListener() {}, removeEventListener() {} };
    Object.defineProperty(window, "visualViewport", {
      configurable: true,
      value: { height, ...listeners },
    });
  };

  afterEach(() => {
    Object.defineProperty(window, "visualViewport", { configurable: true, value: undefined });
  });

  it("sizes the panel from the visible viewport, not the window", () => {
    // 500 visible inside an 800 window is exactly the case a URL bar
    // creates, and the difference between the two is the whole bug.
    window.innerHeight = 800;
    withVisualViewport(500);

    renderSite();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const panel = document.getElementById("mobile-menu")!;
    // jsdom reports every box at the origin, so the panel starts at 0 and
    // the height is the visible area less the breathing room.
    expect(panel.style.maxHeight).toBe("488px");
  });

  it("never collapses the panel to nothing on a freak measurement", () => {
    withVisualViewport(20);

    renderSite();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    // A short scrollable panel beats an invisible one.
    expect(document.getElementById("mobile-menu")!.style.maxHeight).toBe("220px");
  });

  it("keeps the controls out of the scrolling list", () => {
    renderSite();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const panel = document.getElementById("mobile-menu")!;
    const scroller = panel.querySelector("[class*='overflow-y-auto']")!;
    // Scoped to the panel: the desktop header carries its own copy of both
    // controls, hidden by CSS but present in the DOM all the same.
    const textSize = within(panel).getByRole("group", { name: "Text size" });

    // Inside the scroller they scroll away with the list; outside it, in a
    // `shrink-0` row, they are the one part that always keeps its room.
    expect(scroller.contains(textSize)).toBe(false);
    expect(panel.contains(textSize)).toBe(true);
    expect(textSize.parentElement!.className).toContain("shrink-0");
  });

  it("gives the list the room that is left rather than its full height", () => {
    renderSite();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const scroller = document.getElementById("mobile-menu")!.querySelector(
      "[class*='overflow-y-auto']",
    )!;
    // `min-h-0` is load-bearing: without it a flex child refuses to shrink
    // below its content and pushes the controls off the bottom again.
    expect(scroller.className).toContain("min-h-0");
    expect(scroller.className).toContain("flex-1");
  });

  it("lists the pages by name, without the explanation under each one", () => {
    renderSite();
    fireEvent.click(screen.getByRole("button", { name: "Menu" }));

    const panel = document.getElementById("mobile-menu")!;
    // Scoped for the same reason: the footer sitemap lists it too.
    expect(within(panel).getByRole("link", { name: "League tables" })).toBeTruthy();
    // Two lines a link, twenty-two links: it doubled the height of the one
    // thing between a reader and the fixture they came for.
    expect(panel.textContent).not.toContain("Who is top of each division");
  });
});
