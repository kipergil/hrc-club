import { ArrowLeft, ArrowUp, ChevronRight, Home, Megaphone, Menu, Moon, Printer, Sun, X } from "lucide-react";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { NAV, findGroup, findSection } from "@/lib/nav";
import { useSettings } from "@/lib/queries";
import { lockPageScroll, useRouteTransition } from "@/lib/scroll";
import { isPrintable } from "@/lib/print";
import { cn } from "@/lib/utils";
import { Prose } from "@/components/ui";

// ---------------------------------------------------------------------------
// Reader preferences
// ---------------------------------------------------------------------------

/**
 * A / A+ / A++, persisted to localStorage.
 *
 * This exists because older readers frequently do not know browser zoom
 * exists, and a site for them should not assume they do. It scales the root
 * font size, so everything sized in rem — which is everything — grows with
 * it, rather than only the body copy.
 *
 * It used to sit in the top-right of every page as three large buttons,
 * the first of them filled solid brand-green: the loudest element on a
 * page whose actual subject is a fixture list. It is a preference, set
 * once, so it now reads as one — a small segmented control, and on a phone
 * it lives inside the menu rather than competing with the masthead.
 */
function TextSizeControl({ className }: { className?: string }) {
  const [scale, setScale] = useState("1");

  useEffect(() => {
    try {
      const saved = localStorage.getItem("hrc-text-scale");
      if (saved) setScale(saved);
    } catch {
      // Site data blocked. The default size is a perfectly good outcome.
    }
  }, []);

  function apply(next: string) {
    setScale(next);
    document.documentElement.style.setProperty("--text-scale", next);
    try {
      localStorage.setItem("hrc-text-scale", next);
    } catch {
      // Not being able to remember the choice is not a reason to refuse it.
    }
  }

  const options = [
    { value: "1", label: "A", description: "Normal text size" },
    { value: "1.15", label: "A+", description: "Larger text" },
    { value: "1.3", label: "A++", description: "Largest text" },
  ];

  return (
    <div
      role="group"
      aria-label="Text size"
      className={cn("inline-flex items-center rounded-card border border-line bg-surface p-0.5", className)}
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => apply(option.value)}
          aria-pressed={scale === option.value}
          className={cn(
            "flex min-h-touch min-w-touch items-center justify-center rounded-[0.55rem] px-3 font-semibold transition-colors",
            scale === option.value
              ? "bg-brand-soft text-brand"
              : "text-ink-muted hover:bg-surface-sunken hover:text-ink",
          )}
        >
          <span aria-hidden="true">{option.label}</span>
          <span className="sr-only">{option.description}</span>
        </button>
      ))}
    </div>
  );
}

function ThemeToggle({ className }: { className?: string }) {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = (() => {
      try {
        return localStorage.getItem("hrc-theme");
      } catch {
        return null;
      }
    })();
    setDark(
      saved === "dark" ||
        (saved === null && window.matchMedia("(prefers-color-scheme: dark)").matches),
    );
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.setAttribute("data-theme", next ? "dark" : "light");
    try {
      localStorage.setItem("hrc-theme", next ? "dark" : "light");
    } catch {
      // As above.
    }
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className={cn(
        "flex min-h-touch min-w-touch items-center justify-center rounded-card border border-line bg-surface text-ink-muted transition-colors hover:border-line-strong hover:text-ink",
        className,
      )}
    >
      {dark ? (
        <Sun aria-hidden="true" className="size-5" />
      ) : (
        <Moon aria-hidden="true" className="size-5" />
      )}
      <span className="sr-only">{dark ? "Switch to light colours" : "Switch to dark colours"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

/**
 * The active entry is marked by a rule beneath it rather than a filled
 * green pill. At nav size the pill was a heavy block of brand colour
 * sitting directly under the masthead, and with five of them in a row the
 * header read as a toolbar rather than a set of links.
 */
function DesktopNav({ pathname }: { pathname: string }) {
  const activeGroup = findGroup(pathname);

  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="-mb-px flex gap-1">
        {NAV.map((group) => {
          const active = activeGroup?.label === group.label;
          return (
            <li key={group.label}>
              <Link
                href={group.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-touch items-center border-b-2 px-4 text-lg font-semibold no-underline transition-colors",
                  active
                    ? "border-brand text-brand"
                    : "border-transparent text-ink hover:border-line-strong hover:text-brand",
                )}
              >
                {group.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * A large labelled "Menu" button, never a bare hamburger icon, and it opens
 * on click — the audit found the previous site's menu opened on hover and
 * could not be opened by touch at all. Everything inside is a plain link
 * list, so the whole map is visible at once rather than hidden behind
 * nested submenus.
 *
 * The display preferences live at the bottom of this panel on a phone.
 * They were previously four large buttons above the fold, which on a
 * 390px screen meant the first thing a reader met was a row of controls
 * for adjusting a page they had not yet seen.
 */
function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  // Escape closes it, because a panel that covers the page needs a way out
  // that is not "find the button again".
  useEffect(() => {
    if (!open) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  /*
   * The page stays put while the menu is over it. The panel hangs off the
   * header, and the header scrolls: without this, one flick sends the open
   * menu off the top of the screen and leaves the reader looking at the
   * middle of the page they were trying to leave, with the button still
   * reporting the menu as open.
   */
  useEffect(() => {
    if (!open) return;
    return lockPageScroll();
  }, [open]);

  /*
   * Fit the panel to what the reader can actually see.
   *
   * This is the bug that hid the text-size and dark-mode controls on a
   * phone. The panel was `70vh` of list plus a row of controls beneath it,
   * and Chrome reports `100vh` as the *large* viewport — the height with
   * the URL bar retracted — while the visible area is around 110px
   * shorter whenever that bar is showing. So the controls sat below the
   * fold on every phone size, and because the page behind is deliberately
   * locked, nothing could scroll to reach them.
   *
   * `visualViewport.height` is the number that actually changes as the URL
   * bar comes and goes, which is why it is measured rather than assumed.
   * `dvh` would do most of this job in CSS, but not the part that matters:
   * the panel starts an unknown distance down the page, under a masthead
   * whose height depends on the reader's chosen text size.
   */
  useEffect(() => {
    if (!open) return;

    function fit() {
      const panel = panelRef.current;
      if (!panel) return;
      const visible = window.visualViewport?.height ?? window.innerHeight;
      const top = panel.getBoundingClientRect().top;
      // A floor, so a freak measurement cannot collapse the menu to
      // nothing — a short scrollable panel beats an invisible one.
      panel.style.maxHeight = `${Math.max(220, visible - top - 12)}px`;
    }

    fit();
    window.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("resize", fit);
    window.visualViewport?.addEventListener("scroll", fit);
    return () => {
      window.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("resize", fit);
      window.visualViewport?.removeEventListener("scroll", fit);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex min-h-touch items-center gap-1.5 rounded-card border border-line-strong bg-surface px-3 text-lg font-semibold text-ink shadow-raised transition-colors hover:border-brand hover:text-brand sm:gap-2 sm:px-4"
      >
        {open ? (
          <X aria-hidden="true" className="size-6" />
        ) : (
          <Menu aria-hidden="true" className="size-6" />
        )}
        Menu
      </button>

      {open ? (
        <>
          {/*
            Tapping the page closes the menu. With the page held still
            underneath, a reader who opened this by accident and did not
            spot the X would otherwise be looking at a site that had
            stopped responding to the only gesture they were using.

            `top-full` measures itself against the header, so the dimmed
            area begins exactly where the header ends and the masthead
            stays legible behind the panel.
          */}
          <div
            aria-hidden="true"
            onClick={() => setOpen(false)}
            /* `dvh`, not `vh`: the same URL-bar difference that used to
               push the controls below the fold left a strip of undimmed
               page under the backdrop. */
            className="absolute inset-x-0 top-full z-30 h-[100dvh] bg-black/40"
          />
          <div
            ref={panelRef}
            id="mobile-menu"
            /*
              A column, so the list takes the room that is left and the
              controls keep theirs. The height comes from the effect above.
            */
            className="absolute inset-x-0 z-40 mt-3 flex flex-col animate-fade-in-up border-y border-line bg-surface shadow-lifted"
          >
            {/*
              `min-h-0` is load-bearing: a flex child will not shrink below
              its content without it, so the list would push the controls
              off the bottom again and scroll nothing.

              `overscroll-contain`: reaching the end of this list must not
              hand the flick on to the page behind it.
            */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-1">
              {NAV.map((group) => (
                <section key={group.label} className="border-b border-line py-2 last:border-b-0">
                  <h2 className="px-2 py-1 font-semibold uppercase tracking-wide text-ink-muted">
                    {group.label}
                  </h2>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.href}>
                        {/*
                          The name only. Each entry used to carry its
                          plain-English subtitle, which is worth having on
                          a page and is two lines a link in a list of
                          twenty-two — it doubled the height of the one
                          thing standing between a reader and the fixture
                          they came for. `nav.ts` still holds the
                          subtitles; nothing renders them here.
                        */}
                        <Link
                          href={link.href}
                          aria-current={link.href === pathname ? "page" : undefined}
                          className={cn(
                            "flex min-h-touch items-center justify-between gap-3 rounded-card px-2 text-lg font-semibold text-brand no-underline transition-colors hover:bg-brand-soft",
                            link.href === pathname && "bg-brand-soft",
                          )}
                        >
                          {link.title}
                          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            {/*
              `shrink-0`, so this is the one part of the panel that never
              gives up its room. It is the reason the panel is a column at
              all: these controls are how a reader who cannot read the site
              makes it readable, and they were the first thing to fall off
              the bottom.
            */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-t border-line bg-surface-sunken px-4 py-2">
              <TextSizeControl />
              <ThemeToggle />
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Header and footer
// ---------------------------------------------------------------------------

function Header({ pathname }: { pathname: string }) {
  const { data: settings } = useSettings();

  return (
    <header id="top" className="relative z-40 border-b border-line bg-surface no-print">
      <div className="mx-auto max-w-page px-4">
        <div className="masthead-row flex items-center justify-between gap-4 py-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3 no-underline">
            {/*
              The league's own badge, from the original site. Decorative
              here — `alt=""` — because the league's name is written out
              immediately beside it, and a screen reader announcing "the
              league badge" before the name it already reads is noise.

              Fixed height rather than width: it sits on the same optical
              line as the masthead at every size, and the intrinsic
              width/height keep the row from reflowing as it loads.

              Gone when the row is very narrow — a 320px phone, or a wider
              one at the largest text size. It is the one thing in this row
              that is decorative, which `alt=""` already says, and when the
              badge, the Menu button and the league's own name cannot all
              have their width, the name wins.
            */}
            <img
              src="/httl-badge.png"
              alt=""
              width={196}
              height={153}
              className="masthead-badge site-badge h-9 w-auto shrink-0 sm:h-11 lg:h-14"
            />
            <span className="min-w-0">
              {/*
                A site's own name reads as one line or it reads as broken,
                so neither of these wraps and the wording and the size step
                to suit the room instead.

                Which of the two shows, how big, and whether it may wrap
                after all is decided in `index.css`, against the width of
                this row — see the `.masthead-*` rules there for why it
                cannot be decided here in Tailwind's `sm:` / `lg:`
                variants. The short version: the reader's own text-size
                control changes how much room the name needs, and a media
                query cannot see that. Deliberately no `hidden` / `block` /
                `text-xl` here either — utilities are a later layer and
                would beat those rules whichever way they came out.

                Truncating instead was tried and rejected long ago — it
                rendered the masthead as "Hertford …", a site whose name is
                cut off before the first word of it that identifies
                anything.
              */}
              <span className="masthead-short font-semibold tracking-tight text-ink transition-colors group-hover:text-brand">
                {settings?.shortName ?? settings?.clubName ?? "Herts TTL"}
              </span>
              <span className="masthead-full font-semibold tracking-tight text-ink transition-colors group-hover:text-brand">
                {settings?.clubName ?? "Hertford & District Table Tennis League"}
              </span>
              {settings?.strapline ? (
                <span className="mt-0.5 hidden truncate text-ink-muted sm:block">
                  {settings.strapline}
                </span>
              ) : null}
            </span>
          </Link>

          <div className="flex shrink-0 items-center gap-2">
            {/* On a phone these live in the menu instead. */}
            <TextSizeControl className="hidden lg:inline-flex" />
            <ThemeToggle className="hidden lg:flex" />
            <MobileNav pathname={pathname} />
          </div>
        </div>

        <DesktopNav pathname={pathname} />
      </div>
    </header>
  );
}

function Footer() {
  const { data: settings } = useSettings();
  const year = new Date().getFullYear();

  // "Home" is a single-link group in the main nav, which as a footer column
  // was one heading above one link repeating it. The sitemap here shows the
  // four groups that actually have somewhere to go.
  const columns = NAV.filter((group) => group.links.length > 1);

  return (
    <footer className="mt-20 border-t border-line bg-surface no-print">
      <div className="mx-auto max-w-page px-4 py-12">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {columns.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h2 className="font-semibold uppercase tracking-wide text-ink-muted">{group.label}</h2>
              <ul className="mt-3 space-y-2">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="link">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-line pt-6 text-ink-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © {year} {settings?.clubName ?? "Hertford & District Table Tennis League"}
            {settings?.foundedYear ? ` · Founded ${settings.foundedYear}` : null}
          </p>
          <ul className="flex flex-wrap items-center gap-x-4 gap-y-1">
            <li>
              <Link href="/accessibility" className="link">
                Accessibility
              </Link>
            </li>
            <li>
              <Link href="/privacy" className="link">
                Privacy
              </Link>
            </li>
            <li>
              <Link href="/help" className="link">
                Help with this page
              </Link>
            </li>
            {/*
              "Enter a result" used to be here and only here — findable if
              you knew to look, which is a poor place for the one thing
              eighteen captains do every week of the season. It is in the
              Fixtures menu now, and on every match page, so a second copy
              down here would only be a third place to look.
            */}
            {settings?.contactEmail ? (
              <li>
                <a href={`mailto:${settings.contactEmail}`} className="link">
                  {settings.contactEmail}
                </a>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------
// The league notice
// ---------------------------------------------------------------------------

/**
 * A stable key for one particular announcement.
 *
 * Dismissal has to be per-announcement, not per-site: a reader who closes
 * the AGM notice should not thereby switch off the notice telling them
 * next week's fixtures have moved. Hashing the text means a new
 * announcement is a new key, and reappears.
 */
function announcementKey(text: string): string {
  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) | 0;
  }
  return `hrc-notice-${hash}`;
}

/**
 * The league's standing notice.
 *
 * This was the site's single worst piece of UX. It rendered at full length
 * on *every* page — five lines of AGM detail and a seasonal welcome —
 * above the breadcrumbs, the page title and the content. On a 1280px
 * screen it filled the first viewport; on a phone it filled two. Someone
 * looking up a fixture met the AGM date first, on every page, every time,
 * with no way to put it away.
 *
 * It is now one line with the notice's first sentence, expandable in place
 * for the rest, and dismissible for good. It stays visually distinct — it
 * is the one thing on the site the committee can shout with — but it costs
 * a strip rather than a screen.
 */
function LeagueNotice({ announcement }: { announcement: string }) {
  const storageKey = announcementKey(announcement);
  const [dismissed, setDismissed] = useState(false);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(storageKey) === "dismissed");
    } catch {
      // Site data blocked; the notice simply stays put, which is the safe
      // side to fail on for something the committee wants read.
    }
  }, [storageKey]);

  if (dismissed) return null;

  // The first paragraph is the headline; anything after it is detail.
  const [headline, ...rest] = announcement.split(/\n{2,}/).filter(Boolean);
  const hasMore = rest.length > 0;

  function dismiss() {
    setDismissed(true);
    try {
      localStorage.setItem(storageKey, "dismissed");
    } catch {
      // Dismissing for this page view only is still better than not at all.
    }
  }

  return (
    <div className="border-b border-accent/25 bg-accent-soft no-print">
      <div className="mx-auto flex max-w-page items-start gap-3 px-4 py-3">
        <Megaphone aria-hidden="true" className="mt-0.5 size-5 shrink-0 text-accent" />

        <div className="min-w-0 flex-1">
          {/*
            The label runs into the notice rather than sitting on its own
            line. This strip appears above every page on the site, so
            thirty-odd pixels of heading is thirty-odd pixels taken off
            every page.
          */}
          <div className="max-w-readable text-ink">
            {expanded ? (
              <>
                <p className="font-semibold text-accent">League notice</p>
                <Prose markdown={announcement} className="mt-0.5 max-w-readable" />
              </>
            ) : (
              <p>
                <span className="whitespace-nowrap font-semibold text-accent">League notice</span>
                <span aria-hidden="true" className="mx-2 text-accent/50">
                  ·
                </span>
                {headline}
              </p>
            )}
          </div>

          {hasMore ? (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              className="inline-flex min-h-touch items-center font-semibold text-accent underline underline-offset-4"
            >
              {expanded ? "Show less" : "Read the full notice"}
            </button>
          ) : null}
        </div>

        <button
          type="button"
          onClick={dismiss}
          className="flex size-11 shrink-0 items-center justify-center rounded-card text-accent transition-colors hover:bg-accent/10"
        >
          <X aria-hidden="true" className="size-5" />
          <span className="sr-only">Dismiss this notice</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page furniture
// ---------------------------------------------------------------------------

/**
 * The trail, rendered from inside `PageHeader`.
 *
 * It used to live in `Layout`, above the page's own content, which meant
 * it could only ever name things the menu knows: a detail page fell
 * through `findLink` entirely and read "Home › Clubs" with no section and
 * no subject. Rendering it here gives it the page's own title — the team,
 * the club, the match — with no context, no effect and nothing to go
 * stale on a route change.
 *
 * Four levels at most: Home › group › section › this page. The section is
 * dropped when it *is* this page, so a top-level page keeps a two-step
 * trail rather than repeating itself.
 */
function Breadcrumbs({ pathname, title }: { pathname: string; title: string }) {
  if (pathname === "/") return null;

  const group = findGroup(pathname);
  const section = findSection(pathname);
  const trail: Array<{ label: string; href?: string }> = [{ label: "Home", href: "/" }];

  if (group && group.label !== "Home") trail.push({ label: group.label, href: group.href });
  if (section && section.href !== pathname && section.href !== group?.href) {
    trail.push({ label: section.title, href: section.href });
  }
  // The leaf is the page's own name, which for a detail page is the only
  // place its subject appears in the trail at all.
  trail.push({ label: section?.href === pathname ? section.title : title });

  return (
    <nav aria-label="Breadcrumb" className="mb-4 no-print">
      <ol className="flex flex-wrap items-center gap-1.5 text-ink-muted">
        {trail.map((step, index) => (
          <li key={`${step.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 ? <ChevronRight aria-hidden="true" className="size-4 shrink-0" /> : null}
            {step.href ? (
              <Link href={step.href} className="link">
                {step.label}
              </Link>
            ) : (
              <span aria-current="page">{step.label}</span>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

/**
 * Every page title carries its plain-English subtitle beneath it. The
 * subtitle is a required prop for the same reason `TableNote` is: the rule
 * only holds if it is impossible to skip.
 *
 * `actions` sit beside the title on a wide screen rather than beneath it,
 * so a print button no longer pushes the page's first sentence down.
 */
export function PageHeader({
  title,
  subtitle,
  actions,
  children,
}: {
  title: string;
  subtitle: string;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  const [pathname] = useLocation();

  return (
    <div className="mb-8">
      <Breadcrumbs pathname={pathname} title={title} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl">{title}</h1>
          <p className="mt-1.5 max-w-readable text-lg text-ink-muted">{subtitle}</p>
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap gap-2 no-print">{actions}</div> : null}
      </div>
      {children ? <div className="mt-5">{children}</div> : null}
    </div>
  );
}

/**
 * The one button shape this row uses, four times.
 *
 * `min-h-touch` is not negotiable and does not shrink: 48px is the target
 * size this site is built to, and most of its readers are the wrong side
 * of sixty. What gives instead is the horizontal padding — the row got
 * narrower so that Back, the section, Home and Print sit on one line
 * where there is room, not shorter.
 */
const footerButton =
  "inline-flex min-h-touch items-center gap-1.5 rounded-card border border-line-strong " +
  "bg-surface px-3 font-semibold text-ink no-underline shadow-raised transition-colors " +
  "hover:border-brand hover:bg-brand-soft hover:text-brand";

/**
 * Print is a real output: captains pin the fixture list to a noticeboard.
 *
 * It used to sit beside the page title, which is the wrong end of a page
 * somebody prints *after* reading. Down here it is next to Back and Home,
 * where a reader who has finished with the page already is.
 *
 * "Print" on the face and "Print this page" to a screen reader: the
 * accessible name contains the visible one, which is what WCAG's
 * label-in-name rule asks, and the fuller wording says what will happen
 * to someone who cannot see the row it sits in.
 */
function PrintButton() {
  return (
    <button type="button" onClick={() => window.print()} aria-label="Print this page" className={footerButton}>
      <Printer aria-hidden="true" className="size-5" />
      Print
    </button>
  );
}

/**
 * Back, up a level, home, and print — at the foot of the page, where
 * someone who has read to the end actually is.
 *
 * The header is a scroll away by then, and on a phone it is behind a Menu
 * button and two screens of table. "Back" is the browser's own history
 * rather than a guessed parent, because after arriving from a league table
 * the page a reader wants is the one they came from; the section link
 * beside it is the guess, offered separately and labelled.
 */
function PageFooterNav({ pathname }: { pathname: string }) {
  const section = findSection(pathname);
  const group = findGroup(pathname);

  /*
   * A link to the page you are already on is furniture. On a section page
   * the section resolves to itself and the group resolves to the same
   * href, so both are dropped and the row is just Back and Home.
   */
  const candidate = section?.href !== pathname ? section : undefined;
  const up = candidate ?? (group && group.href !== pathname && group.href !== "/" ? group : undefined);

  if (pathname === "/") return null;

  return (
    <nav aria-label="Page navigation" className="mt-14 border-t border-line pt-6 no-print">
      <ul className="flex flex-wrap items-center gap-2">
        <li>
          <button type="button" onClick={() => window.history.back()} className={footerButton}>
            <ArrowLeft aria-hidden="true" className="size-5" />
            Back
          </button>
        </li>
        {up ? (
          <li>
            <Link href={up.href} className={footerButton}>
              <ArrowUp aria-hidden="true" className="size-5" />
              {"title" in up ? up.title : up.label}
            </Link>
          </li>
        ) : null}
        <li>
          <Link href="/" className={footerButton}>
            <Home aria-hidden="true" className="size-5" />
            Home
          </Link>
        </li>
        {/* Only where printing the page is a thing anybody would do. */}
        {isPrintable(pathname) ? (
          <li>
            <PrintButton />
          </li>
        ) : null}
        <li className="ml-auto">
          {/*
            `#top`, not `#main`. Long pages are the reason this block
            exists, and what a reader wants at the end of one is the menu —
            but `<main>` starts *below* the header, so this link used to
            stop at the breadcrumb with the masthead, the Menu button and
            the whole navigation still off the top of the screen. It read
            as a "back to top" that would not go to the top.

            The header carries the matching id, so this also parks the
            browser's sequential-focus point there: the next Tab goes into
            the navigation rather than back into the page just left.
          */}
          <a href="#top" className="link font-semibold">
            Back to top
          </a>
        </li>
      </ul>
    </nav>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [pathname] = useLocation();
  const { data: settings } = useSettings();

  // Puts the reader at the top of a new page, back where they were on a
  // back or forward, and focus on the main region either way.
  useRouteTransition();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to the main content
      </a>

      <Header pathname={pathname} />

      {settings?.announcement ? <LeagueNotice announcement={settings.announcement} /> : null}

      {/*
        `tabIndex={-1}` makes this focusable by script without putting it
        in the tab order, which is what lets both the skip link and a route
        change land the reader here.

        The focus ring is left alone. The site's rule is that focus
        indicators are never removed, and the global style keys off
        `:focus-visible` — so a mouse click shows nothing, while a keyboard
        user gets told where they have been put.
      */}
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-page flex-1 px-4 py-8">
        {children}
        <PageFooterNav pathname={pathname} />
      </main>

      <Footer />
    </div>
  );
}
