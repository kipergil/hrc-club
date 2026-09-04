import { ArrowLeft, ArrowUp, ChevronRight, Home, Megaphone, Menu, Moon, Printer, Sun, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { NAV, findGroup, findSection } from "@/lib/nav";
import { useSettings } from "@/lib/queries";
import { lockPageScroll, useRouteTransition } from "@/lib/scroll";
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

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 text-lg font-semibold text-ink shadow-raised transition-colors hover:border-brand hover:text-brand"
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
            className="absolute inset-x-0 top-full z-30 h-screen bg-black/40"
          />
          <div
            id="mobile-menu"
            className="absolute inset-x-0 z-40 mt-3 animate-fade-in-up border-y border-line bg-surface shadow-lifted"
          >
            {/*
              `overscroll-contain`: reaching the end of this list must not
              hand the flick on to the page behind it.
            */}
            <div className="max-h-[70vh] overflow-y-auto overscroll-contain px-4 py-2">
              {NAV.map((group) => (
                <section key={group.label} className="border-b border-line py-3 last:border-b-0">
                  <h2 className="px-2 py-1 font-semibold uppercase tracking-wide text-ink-muted">
                    {group.label}
                  </h2>
                  <ul>
                    {group.links.map((link) => (
                      <li key={link.href}>
                        <Link
                          href={link.href}
                          aria-current={link.href === pathname ? "page" : undefined}
                          className={cn(
                            "flex min-h-touch items-center justify-between gap-3 rounded-card px-2 py-2.5 no-underline transition-colors hover:bg-brand-soft",
                            link.href === pathname && "bg-brand-soft",
                          )}
                        >
                          <span>
                            <span className="block text-lg font-semibold text-brand">
                              {link.title}
                            </span>
                            <span className="block text-ink-muted">{link.subtitle}</span>
                          </span>
                          <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-ink-muted" />
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-surface-sunken px-4 py-3">
              <span className="font-semibold text-ink">Display</span>
              <div className="flex items-center gap-2">
                <TextSizeControl />
                <ThemeToggle />
              </div>
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
        <div className="flex items-center justify-between gap-4 py-4">
          <Link href="/" className="group flex min-w-0 items-center gap-3 no-underline">
            {/*
              The league's own badge, from the original site. Decorative
              here — `alt=""` — because the league's name is written out
              immediately beside it, and a screen reader announcing "the
              league badge" before the name it already reads is noise.

              Fixed height rather than width: it sits on the same optical
              line as the masthead at every size, and the intrinsic
              width/height keep the row from reflowing as it loads.
            */}
            <img
              src="/httl-badge.png"
              alt=""
              width={196}
              height={153}
              className="site-badge h-11 w-auto shrink-0 sm:h-14"
            />
            <span className="min-w-0">
              {/*
                The short name on a phone, the full name from 640px up.
                Truncating the full one instead rendered the masthead as
                "Hertford …" on a 390px screen — a site whose own name is
                cut off before the first word of it that identifies anything.
              */}
              <span className="block text-xl font-semibold tracking-tight text-ink transition-colors group-hover:text-brand sm:hidden">
                {settings?.shortName ?? settings?.clubName ?? "Herts TTL"}
              </span>
              <span className="hidden text-2xl font-semibold tracking-tight text-ink transition-colors group-hover:text-brand sm:block">
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
              Where a captain goes to enter a result. In the footer rather
              than the menu because it is for a handful of people, and the
              league's own site puts its Admin link in much the same
              place — findable if you know to look, out of the way if not.
            */}
            <li>
              <Link href="/admin/scorecards" className="link">
                Enter a result
              </Link>
            </li>
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

/** Print is a real output: captains pin the fixture list to a noticeboard. */
export function PrintButton({ label = "Print this page" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 font-semibold text-ink shadow-raised transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand no-print"
    >
      <Printer aria-hidden="true" className="size-5" />
      {label}
    </button>
  );
}

/**
 * Back, up a level, and home — at the foot of the page, where someone who
 * has read to the end actually is.
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
      <ul className="flex flex-wrap items-center gap-3">
        <li>
          <button
            type="button"
            onClick={() => window.history.back()}
            className="inline-flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 font-semibold text-ink shadow-raised transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
          >
            <ArrowLeft aria-hidden="true" className="size-5" />
            Back
          </button>
        </li>
        {up ? (
          <li>
            <Link
              href={up.href}
              className="inline-flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 font-semibold text-ink no-underline shadow-raised transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
            >
              <ArrowUp aria-hidden="true" className="size-5" />
              {"title" in up ? up.title : up.label}
            </Link>
          </li>
        ) : null}
        <li>
          <Link
            href="/"
            className="inline-flex min-h-touch items-center gap-2 rounded-card border border-line-strong bg-surface px-4 font-semibold text-ink no-underline shadow-raised transition-colors hover:border-brand hover:bg-brand-soft hover:text-brand"
          >
            <Home aria-hidden="true" className="size-5" />
            Home
          </Link>
        </li>
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
