import { PageHeader } from "@/components/layout";
import { Empty, ErrorNote, Loading, Prose } from "@/components/ui";
import { findLink } from "@/lib/nav";
import { usePage } from "@/lib/queries";

/**
 * Every purely editorial page — About, Our history, Coaching, Juniors,
 * Privacy, Accessibility, Safeguarding — is this component with a
 * different slug.
 *
 * The heading and subtitle come from `nav.ts` when the route is in the
 * menu, and from the Directus row otherwise. That ordering matters: the
 * menu is where the "every page keeps its name" rule is enforced, so the
 * menu wins, and an editor renaming a page in Directus cannot silently
 * rename it in the navigation.
 */
export function CmsPage({ slug, fallbackTitle }: { slug: string; fallbackTitle?: string }) {
  const { data: page, isLoading, isError, error } = usePage(slug);
  const navLink = findLink(`/${slug}`) ?? findLink(`/about/${slug}`);

  const title = navLink?.title ?? page?.title ?? fallbackTitle ?? "Page";
  const subtitle = navLink?.subtitle ?? page?.subtitle ?? "";

  if (isLoading) return <Loading what="this page" />;

  // A 404 from the API means the committee has not written this page yet,
  // which is a different thing from something being broken — and it is
  // worth saying so plainly rather than showing an error.
  if (isError && (error as { status?: number })?.status === 404) {
    return (
      <>
        <PageHeader title={title} subtitle={subtitle} />
        <Empty>
          There’s nothing on this page yet. We’re still writing it — please check back, or ask us
          directly and we’ll tell you what you need to know.
        </Empty>
      </>
    );
  }

  if (isError || !page) return <ErrorNote what="page" />;

  return (
    <article>
      <PageHeader title={title} subtitle={subtitle || (page.subtitle ?? "")} />
      {page.body ? (
        <Prose markdown={page.body} />
      ) : (
        <Empty>This page has been created but not written yet.</Empty>
      )}
    </article>
  );
}

export const AboutPage = () => <CmsPage slug="about" fallbackTitle="About the club" />;
export const HistoryPage = () => <CmsPage slug="history" fallbackTitle="Our history" />;
export const PrivacyPage = () => <CmsPage slug="privacy" fallbackTitle="Privacy notice" />;
export const AccessibilityPage = () => (
  <CmsPage slug="accessibility" fallbackTitle="Accessibility statement" />
);
export const SafeguardingPage = () => <CmsPage slug="safeguarding" fallbackTitle="Safeguarding" />;
