import { useEffect, useRef } from "react";
import { useLocation } from "wouter";

/**
 * What a browser does for free on a normal site, and a single-page app has
 * to do for itself.
 *
 * Following a link here swaps the page's contents without touching the
 * scroll position, so someone two-thirds of the way down the roll of
 * honour who taps "Clubs" lands two-thirds of the way down the clubs page
 * — reading the middle of a list, with the menu somewhere off the top of
 * the screen. On the long pages this site has a lot of, it reads as though
 * the link did nothing at all.
 *
 * Three things happen on a route change, and only the first is about
 * scrolling:
 *
 *  1. **Forward navigation goes to the top.** Instantly, not smoothly:
 *     `html { scroll-behavior: smooth }` is right for a jump to an anchor
 *     on the page you are already reading, and wrong for a new page, where
 *     it animates a long way through content nobody asked to see.
 *
 *  2. **Back and forward return you where you were.** Scrolling to the top
 *     unconditionally would fix one annoyance by creating another: tap a
 *     match, press back, and you are at the top of the fixture list again
 *     rather than at the match you tapped.
 *
 *  3. **Focus moves to the main region.** The same bug in the other sense:
 *     after a route change focus is left on a link that no longer relates
 *     to what is on screen, so a screen reader announces nothing and a
 *     keyboard user's next Tab carries on from wherever the old page's
 *     menu was. Moving focus to `<main>` is what makes the new page get
 *     read out, and it pairs with the skip link that targets the same
 *     element.
 */

/*
 * Module scope rather than component state, and the listeners are
 * installed on import rather than in an effect. Both are deliberate.
 *
 * There is one history and one scroll position per document, so this is
 * genuinely one thing rather than one per component. More to the point,
 * *when* the popstate listener is registered decides whether any of this
 * works: listeners on `window` run in registration order, wouter
 * subscribes during React's commit, and React flushes the resulting
 * re-render synchronously inside that dispatch. A listener registered from
 * an effect therefore runs after the route has already changed and after
 * this hook has already decided what to do — so the back button read as a
 * forward navigation and scrolled to the top every time. Registering at
 * import time puts this first, before React has mounted anything.
 */

/** Scroll offsets by path, for back and forward. */
const positions = new Map<string, number>();
/** The path on screen, so a recorded offset is filed against the right page. */
let currentPath = "";
/** Set by popstate, read and cleared by the route-change effect. */
let wentBack = false;

/**
 * Where the reader is, right now, on the page they are still looking at.
 *
 * Recorded as the navigation starts rather than from a `scroll` listener.
 * A listener looks like the obvious way to do this and is wrong: swapping
 * in a shorter page makes the browser clamp the scroll position, which
 * fires a `scroll` event of its own *after* the DOM has changed but before
 * this module has noticed the route did. That event writes the clamped
 * value — usually 0 — over the position actually being left, so going back
 * lands at the top of the list anyway.
 *
 * A click and a popstate both happen before any of that, while
 * `window.scrollY` still means what it says.
 */
function remember(): void {
  if (currentPath) positions.set(currentPath, window.scrollY);
}

// Guarded because the prerenderer imports this module under Node, where
// there is no window to listen on and nothing to scroll.
if (typeof window !== "undefined") {
  if ("scrollRestoration" in window.history) {
    // Otherwise the browser's own restore fights the one below.
    window.history.scrollRestoration = "manual";
  }
  // Capture phase, so this beats the router's handler on the link itself.
  // Keyboard activation of a link fires a click too, so this covers both.
  document.addEventListener("click", remember, true);
  window.addEventListener("popstate", () => {
    remember();
    wentBack = true;
  });
}

export function useRouteTransition(): void {
  const [pathname] = useLocation();

  /**
   * Hydration is not a navigation. On first mount the reader may have
   * arrived at a deep link, reloaded halfway down a page, or followed a
   * link with a fragment — and scrolling them to the top or stealing focus
   * would undo all three.
   */
  const mounted = useRef(false);

  useEffect(() => {
    const from = currentPath;
    currentPath = pathname;

    if (!mounted.current) {
      mounted.current = true;
      return;
    }

    // Wouter re-runs this when only the search string changes — a filter,
    // say. That is the same page, and moving the reader is wrong.
    if (from === pathname) return;

    const restoring = wentBack;
    wentBack = false;
    const saved = positions.get(pathname);

    /*
     * A link carrying a fragment means the reader asked for a particular
     * part of the page, so that wins over both rules below. The element
     * only exists once React has rendered the new route, which is why this
     * runs here rather than in the click handler.
     */
    const hash = window.location.hash.slice(1);
    if (hash) {
      const target = document.getElementById(hash);
      if (target) {
        target.scrollIntoView();
        focusMain();
        return;
      }
    }

    window.scrollTo({ top: restoring && saved !== undefined ? saved : 0, behavior: "instant" });
    focusMain();
  }, [pathname]);
}

/**
 * `preventScroll` because the scroll position is decided above; without it
 * the browser would scroll `<main>` into view and quietly undo a restore.
 */
function focusMain(): void {
  const main = document.getElementById("main");
  if (main instanceof HTMLElement) main.focus({ preventScroll: true });
}

/**
 * Hold the page still while something is open on top of it.
 *
 * The menu panel is positioned against the header, and the header scrolls
 * with the page: open the menu, flick the screen, and the menu travels off
 * the top while the fixture list slides past underneath it. It is still
 * open — the button still says so — but there is nothing on screen to
 * choose from and no obvious way back to it. That is the failure that
 * reads as "scrolling doesn't show the menu".
 *
 * `overflow: hidden` on the root element rather than on `<body>` alone:
 * body-only is the version that does nothing on iOS, and this site's
 * readers are largely on iPads. Neither moves the document, so the reader
 * is exactly where they were when it is released.
 *
 * The padding replaces the width a classic scrollbar was taking up. Without
 * it the page silently widens by fifteen pixels as the menu opens, and
 * every line of text on it reflows.
 *
 * Returns the release.
 */
export function lockPageScroll(): () => void {
  const root = document.documentElement;
  const { body } = document;
  const gap = window.innerWidth - root.clientWidth;

  const previous = {
    rootOverflow: root.style.overflow,
    bodyOverflow: body.style.overflow,
    bodyPadding: body.style.paddingRight,
  };

  root.style.overflow = "hidden";
  body.style.overflow = "hidden";
  if (gap > 0) body.style.paddingRight = `${gap}px`;

  return () => {
    root.style.overflow = previous.rootOverflow;
    body.style.overflow = previous.bodyOverflow;
    body.style.paddingRight = previous.bodyPadding;
  };
}
