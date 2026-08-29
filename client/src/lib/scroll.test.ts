/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The parts of the route transition that can be checked without a browser.
 *
 * The behaviour itself — top on a forward navigation, back where you were
 * on a back, focus on `<main>` either way — needs a real history and a real
 * scroll position, so it is verified against the running site. What is
 * worth pinning here is the wiring that made it wrong twice while I was
 * building it, because neither failure looks like anything from the
 * outside:
 *
 *  - The popstate listener has to be registered at import time. Registered
 *    from an effect, it runs *after* wouter's, which is enough for the back
 *    button to be mistaken for a forward navigation.
 *  - The module is imported by the prerenderer under Node, where there is
 *    no `window`. Touching one at import time takes the whole build down.
 */

describe("the route transition module", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("registers its popstate listener at import time, not from an effect", async () => {
    // Wouter subscribes during React's commit and React flushes the
    // resulting re-render inside the popstate dispatch, so a listener added
    // later never sees the event in time to say "this was a back".
    const listeners: string[] = [];
    const addEventListener = vi
      .spyOn(window, "addEventListener")
      .mockImplementation(((type: string) => {
        listeners.push(type);
      }) as never);

    await import("./scroll");

    expect(listeners).toContain("popstate");
    addEventListener.mockRestore();
  });

  it("takes the browser's scroll restoration off automatic", async () => {
    // Left on, the browser restores a position of its own choosing and
    // fights the one this module sets.
    window.history.scrollRestoration = "auto";
    await import("./scroll");
    expect(window.history.scrollRestoration).toBe("manual");
  });

  it("records the outgoing position from a click, never from a scroll listener", async () => {
    /*
     * A scroll listener is the obvious implementation and silently loses
     * the position: swapping in a shorter page makes the browser clamp the
     * scroll, firing a `scroll` event after the DOM has changed but before
     * the route change is noticed — so the clamped value, usually 0,
     * overwrites the position being left.
     */
    const types: string[] = [];
    const onDocument = vi
      .spyOn(document, "addEventListener")
      .mockImplementation(((type: string) => {
        types.push(type);
      }) as never);

    await import("./scroll");

    expect(types).toContain("click");
    expect(types).not.toContain("scroll");
    onDocument.mockRestore();
  });

});

/*
 * Not tested here: that the module can be imported where there is no
 * `window`. `scripts/prerender.tsx` pulls the whole component tree into
 * Node, so an unguarded `document.addEventListener` at module scope fails
 * the build for all 237 routes at once — a louder and more honest gate
 * than a test that greps this file for the guard it expects to find.
 */
