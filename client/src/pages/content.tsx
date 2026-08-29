import { Link } from "wouter";
import { PageHeader } from "@/components/layout";
import { Empty, ErrorNote, Loading, Prose } from "@/components/ui";
import { findLink } from "@/lib/nav";
import { usePage, useSettings } from "@/lib/queries";

/**
 * The seed data marks its own placeholder copy, so the site can refuse to
 * publish it.
 *
 * `npm run seed` writes realistic-looking editorial text — "HRC is a table
 * tennis club in Hertford… three teams in the Hertford & District League" —
 * so that layouts and empty states can be judged against something with
 * the right shape. Every one of those bodies opens with this marker. None
 * of it is true of the league, and left to itself the About page served it
 * to the public as fact.
 *
 * Treating the marker as "not written yet" means the placeholder can stay
 * where it is useful — in the CMS, for editors — without ever reaching a
 * reader.
 */
const PLACEHOLDER = /^\s*PLACEHOLDER\b/i;

function isPlaceholder(body: string | null | undefined): boolean {
  return typeof body === "string" && PLACEHOLDER.test(body);
}

/**
 * Every purely editorial page — About, Our history, Privacy, Accessibility,
 * Safeguarding — is this component with a different slug.
 *
 * The heading and subtitle come from `nav.ts` when the route is in the
 * menu, and from the Directus row otherwise. That ordering matters: the
 * menu is where the "every page keeps its name" rule is enforced, so the
 * menu wins, and an editor renaming a page in Directus cannot silently
 * rename it in the navigation.
 */
export function CmsPage({
  slug,
  fallbackTitle,
  children,
}: {
  slug: string;
  fallbackTitle?: string;
  /** Shown instead of the empty state when the page has no real body yet. */
  children?: React.ReactNode;
}) {
  const { data: page, isLoading, isError, error } = usePage(slug);
  const navLink = findLink(`/${slug}`) ?? findLink(`/about/${slug}`);

  const title = navLink?.title ?? page?.title ?? fallbackTitle ?? "Page";
  const subtitle = navLink?.subtitle ?? page?.subtitle ?? "";

  if (isLoading) return <Loading what="this page" variant="page" />;

  const missing =
    (isError && (error as { status?: number })?.status === 404) ||
    !page ||
    !page.body ||
    isPlaceholder(page.body);

  // A 404 from the API means the committee has not written this page yet,
  // which is a different thing from something being broken — and it is
  // worth saying so plainly rather than showing an error.
  if (missing) {
    if (isError && (error as { status?: number })?.status !== 404) {
      return <ErrorNote what="page" />;
    }
    return (
      <div className="max-w-readable">
        <PageHeader title={title} subtitle={subtitle} />
        {children ?? (
          <Empty
            action={
              <Link href="/contact" className="link font-semibold">
                Ask the committee
              </Link>
            }
          >
            There’s nothing on this page yet. We’re still writing it — please check back, or ask us
            directly and we’ll tell you what you need to know.
          </Empty>
        )}
      </div>
    );
  }

  return (
    <article className="max-w-readable">
      <PageHeader title={title} subtitle={subtitle || (page.subtitle ?? "")} />
      <Prose markdown={page.body} className="max-w-readable" />
    </article>
  );
}

/**
 * About the league.
 *
 * The league describes itself on its own home page, and that description
 * — its age, its area, its affiliations, its size this season — is the
 * truest text the site has about what it is. The home page shows the first
 * paragraph of it; this page shows all of it, so "More about the league"
 * leads somewhere that answers the question.
 */
export function AboutPage() {
  const { data: settings } = useSettings();

  return (
    <CmsPage slug="about" fallbackTitle="About the league">
      {settings?.aboutSummary ? (
        <>
          <Prose markdown={settings.aboutSummary} className="max-w-readable" />
          <p className="mt-6">
            <Link href="/committee" className="link font-semibold">
              Who's on the committee
            </Link>
          </p>
        </>
      ) : (
        <Empty>The league's description of itself has not been imported yet.</Empty>
      )}
    </CmsPage>
  );
}

export const HistoryPage = () => <CmsPage slug="history" fallbackTitle="Our history" />;
export const PrivacyPage = () => <CmsPage slug="privacy" fallbackTitle="Privacy notice" />;
export const AccessibilityPage = () => (
  <CmsPage slug="accessibility" fallbackTitle="Accessibility statement" />
);
export const SafeguardingPage = () => <CmsPage slug="safeguarding" fallbackTitle="Safeguarding" />;
