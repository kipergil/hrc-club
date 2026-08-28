import { PageHeader } from "@/components/layout";
import { ButtonLink } from "@/components/ui";
import { NAV } from "@/lib/nav";
import { Link } from "wouter";

/**
 * A 404 that gives the reader somewhere to go. The league audit found three
 * navigation links that simply 404'd, with no way back — a dead end is the
 * most avoidable bad experience on any website.
 */
export default function NotFoundPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="We couldn't find that page"
        subtitle="It may have been renamed or moved — here's everything on the site"
      />

      <div className="flex flex-wrap gap-4">
        <ButtonLink href="/">Go to the home page</ButtonLink>
        <ButtonLink href="/contact" variant="secondary">
          Tell us what you were looking for
        </ButtonLink>
      </div>

      <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
        {NAV.filter((group) => group.label !== "Home").map((group) => (
          <nav key={group.label} aria-label={group.label}>
            <h2 className="text-xl">{group.label}</h2>
            <ul className="mt-2 space-y-2">
              {group.links.map((link) => (
                <li key={link.href}>
                  <Link href={link.href} className="text-brand underline underline-offset-4">
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
