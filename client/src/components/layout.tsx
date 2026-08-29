import { Menu, Moon, Printer, Sun, X } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Link, useLocation } from "wouter";
import { NAV, findGroup, findLink } from "@/lib/nav";
import { useSettings } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { Alert, Prose } from "@/components/ui";

// ---------------------------------------------------------------------------

/**
 * A / A+ / A++ in the header, persisted to localStorage.
 *
 * This exists because older readers frequently do not know browser zoom
 * exists, and a site for them should not assume they do. It scales the root
 * font size, so everything sized in rem — which is everything — grows with
 * it, rather than only the body copy.
 */
function TextSizeControl() {
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
    <div className="flex items-center gap-1" role="group" aria-label="Text size">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => apply(option.value)}
          aria-pressed={scale === option.value}
          title={option.description}
          className={cn(
            "min-h-touch min-w-touch rounded-card border-2 px-3 font-bold",
            scale === option.value
              ? "border-brand bg-brand text-brand-ink"
              : "border-line bg-surface text-ink hover:border-brand",
          )}
        >
          <span aria-hidden="true">{option.label}</span>
          <span className="sr-only">{option.description}</span>
        </button>
      ))}
    </div>
  );
}

function ThemeToggle() {
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
      className="flex min-h-touch min-w-touch items-center justify-center rounded-card border-2 border-line bg-surface text-ink hover:border-brand"
    >
      {dark ? <Sun aria-hidden="true" className="size-6" /> : <Moon aria-hidden="true" className="size-6" />}
      <span className="sr-only">{dark ? "Switch to light colours" : "Switch to dark colours"}</span>
    </button>
  );
}

// ---------------------------------------------------------------------------

function DesktopNav({ pathname }: { pathname: string }) {
  const activeGroup = findGroup(pathname);
  return (
    <nav aria-label="Main" className="hidden lg:block">
      <ul className="flex gap-1">
        {NAV.map((group) => (
          <li key={group.label}>
            <Link
              href={group.href}
              aria-current={activeGroup?.label === group.label ? "page" : undefined}
              className={cn(
                "flex min-h-touch items-center rounded-card px-4 text-lg font-semibold no-underline",
                activeGroup?.label === group.label
                  ? "bg-brand text-brand-ink"
                  : "text-ink hover:bg-brand-soft hover:text-brand",
              )}
            >
              {group.label}
            </Link>
          </li>
        ))}
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
 */
function MobileNav({ pathname }: { pathname: string }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-controls="mobile-menu"
        className="flex min-h-touch items-center gap-2 rounded-card border-2 border-brand bg-surface px-4 text-lg font-bold text-brand"
      >
        {open ? <X aria-hidden="true" className="size-6" /> : <Menu aria-hidden="true" className="size-6" />}
        Menu
      </button>

      {open ? (
        <div id="mobile-menu" className="mt-4 rounded-card border border-line bg-surface p-2">
          {NAV.map((group) => (
            <section key={group.label} className="p-2">
              <h2 className="px-2 py-1 text-lg font-bold text-ink-muted">{group.label}</h2>
              <ul>
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="block min-h-touch rounded-card px-2 py-3 no-underline hover:bg-brand-soft"
                    >
                      <span className="block text-lg font-semibold text-brand underline underline-offset-4">
                        {link.title}
                      </span>
                      <span className="block text-ink-muted">{link.subtitle}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      ) : null}
    </div>
  );
}

// ---------------------------------------------------------------------------

function Header({ pathname }: { pathname: string }) {
  const { data: settings } = useSettings();

  return (
    <header className="border-b-4 border-brand bg-surface no-print">
      <div className="mx-auto flex max-w-page flex-wrap items-center justify-between gap-4 px-4 py-4">
        <Link href="/" className="no-underline">
          <span className="block text-2xl font-bold text-brand">
            {settings?.clubName ?? "HRC Table Tennis Club"}
          </span>
          {settings?.strapline ? (
            <span className="block text-ink-muted">{settings.strapline}</span>
          ) : null}
        </Link>

        <div className="flex items-center gap-2">
          <TextSizeControl />
          <ThemeToggle />
        </div>

        <div className="w-full lg:w-auto">
          <DesktopNav pathname={pathname} />
          <MobileNav pathname={pathname} />
        </div>
      </div>
    </header>
  );
}

function Footer() {
  const { data: settings } = useSettings();
  const year = new Date().getFullYear();

  return (
    <footer className="mt-16 border-t-4 border-brand bg-surface no-print">
      <div className="mx-auto max-w-page px-4 py-10">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-5">
          {NAV.map((group) => (
            <nav key={group.label} aria-label={group.label}>
              <h2 className="text-lg font-bold text-ink">{group.label}</h2>
              <ul className="mt-2 space-y-1">
                {group.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} className="text-brand underline underline-offset-4">
                      {link.title}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mt-10 border-t border-line pt-6 text-ink-muted">
          <p>
            © {year} {settings?.clubName ?? "HRC Table Tennis Club"}
            {settings?.foundedYear ? ` · Founded ${settings.foundedYear}` : null}
          </p>
          {settings?.contactEmail ? (
            <p className="mt-1">
              <a href={`mailto:${settings.contactEmail}`} className="text-brand underline">
                {settings.contactEmail}
              </a>
            </p>
          ) : null}
          <p className="mt-3">
            <Link href="/help" className="text-brand underline underline-offset-4">
              Help with this page
            </Link>
            {settings?.leagueUrl ? (
              <>
                {" · "}
                <a href={settings.leagueUrl} className="text-brand underline underline-offset-4">
                  Hertford &amp; District Table Tennis League
                </a>
              </>
            ) : null}
          </p>
        </div>
      </div>
    </footer>
  );
}

// ---------------------------------------------------------------------------

function Breadcrumbs({ pathname }: { pathname: string }) {
  if (pathname === "/") return null;
  const group = findGroup(pathname);
  const link = findLink(pathname);

  return (
    <nav aria-label="Breadcrumb" className="mb-4 no-print">
      <ol className="flex flex-wrap items-center gap-2 text-ink-muted">
        <li>
          <Link href="/" className="text-brand underline underline-offset-4">
            Home
          </Link>
        </li>
        {group && group.label !== "Home" ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <Link href={group.href} className="text-brand underline underline-offset-4">
              {group.label}
            </Link>
          </li>
        ) : null}
        {link && link.href !== group?.href ? (
          <li className="flex items-center gap-2">
            <span aria-hidden="true">›</span>
            <span aria-current="page">{link.title}</span>
          </li>
        ) : null}
      </ol>
    </nav>
  );
}

/**
 * Every page title carries its plain-English subtitle beneath it. The
 * subtitle is a required prop for the same reason `TableNote` is: the rule
 * only holds if it is impossible to skip.
 */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children?: ReactNode;
}) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl">{title}</h1>
      <p className="mt-1 max-w-prose text-lg text-ink-muted">{subtitle}</p>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

/** Print is a real output: captains pin the fixture list to a noticeboard. */
export function PrintButton({ label = "Print this page" }: { label?: string }) {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-touch items-center gap-2 rounded-card border-2 border-line bg-surface px-4 font-semibold text-ink hover:border-brand no-print"
    >
      <Printer aria-hidden="true" className="size-5" />
      {label}
    </button>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const [pathname] = useLocation();
  const { data: settings } = useSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <a href="#main" className="skip-link">
        Skip to the main content
      </a>

      <Header pathname={pathname} />

      {settings?.announcement ? (
        <div className="mx-auto w-full max-w-page px-4 pt-6">
          <Alert tone="warning" title="League notice">
            <Prose markdown={settings.announcement} />
          </Alert>
        </div>
      ) : null}

      <main id="main" className="mx-auto w-full max-w-page flex-1 px-4 py-8">
        <Breadcrumbs pathname={pathname} />
        {children}

        {pathname !== "/" ? (
          <p className="mt-12 no-print">
            <Link
              href="/"
              className="inline-flex min-h-touch items-center rounded-card border-2 border-brand px-5 font-semibold text-brand no-underline hover:bg-brand-soft"
            >
              ← Back to home
            </Link>
          </p>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}
