import { Compass } from "lucide-react";
import { Link } from "wouter";
import { ButtonLink } from "@/components/ui";
import { NAV } from "@/lib/nav";

/**
 * A 404 that gives the reader somewhere to go. The league audit found three
 * navigation links that simply 404'd, with no way back — a dead end is the
 * most avoidable bad experience on any website.
 *
 * The whole sitemap is here rather than a "go home" button on its own,
 * because someone who followed a stale link usually knows what they wanted
 * and only needs to be shown where it lives now.
 */
export default function NotFoundPage() {
  return (
    <div className="space-y-10">
      <div className="rounded-panel border border-line bg-surface-sunken p-8 text-center">
        <Compass aria-hidden="true" className="mx-auto size-12 text-ink-muted" />
        <h1 className="mt-4 text-2xl sm:text-3xl">We couldn't find that page</h1>
        <p className="mx-auto mt-3 max-w-prose text-lg text-ink-muted">
          It may have been renamed or moved since you last visited. Everything on the site is listed
          below.
        </p>
        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <ButtonLink href="/">Go to the home page</ButtonLink>
          <ButtonLink href="/contact" variant="secondary">
            Tell us what you were looking for
          </ButtonLink>
        </div>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
        {NAV.filter((group) => group.links.length > 1).map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <h2 className="font-semibold uppercase tracking-wide text-ink-muted">{group.label}</h2>
            <ul className="mt-3 space-y-3">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="link font-semibold">
                    {link.title}
                  </Link>
                  <span className="block text-ink-muted">{link.subtitle}</span>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>
    </div>
  );
}
