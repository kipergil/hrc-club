import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * The site's whole component vocabulary, in one file.
 *
 * There are eleven of them, and that is the point: a club site maintained
 * by volunteers should not carry a component library it uses a tenth of.
 * The accessibility rules that would otherwise be repeated at every call
 * site — 48px targets, no hover-only affordances, text labels beside every
 * colour — live here instead, so a new page gets them by using the
 * vocabulary rather than by remembering the rules.
 */

// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "quiet";

const buttonBase =
  "inline-flex min-h-touch items-center justify-center gap-2 rounded-card px-5 py-3 text-base font-semibold no-underline transition-colors disabled:cursor-not-allowed disabled:opacity-60";

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink hover:bg-brand-strong",
  secondary: "border-2 border-brand bg-surface text-brand hover:bg-brand-soft",
  quiet: "text-brand underline underline-offset-4 hover:bg-brand-soft",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={cn(buttonBase, buttonVariants[variant], className)} {...props} />;
}

/** An internal link that looks like a button. Still a link, so it still opens in a new tab on middle-click. */
export function ButtonLink({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------

export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-5 shadow-card", className)}>
      {children}
    </div>
  );
}

/**
 * A whole card that is one big link — the home page's six destinations.
 * Large target, one clear action, and the heading is the link text so a
 * screen reader's link list reads as a list of destinations.
 */
export function CardLink({
  href,
  title,
  description,
  meta,
}: {
  href: string;
  title: string;
  description: string;
  meta?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-card border-2 border-line bg-surface p-6 no-underline shadow-card hover:border-brand hover:bg-brand-soft"
    >
      <h3 className="text-xl text-brand underline underline-offset-4">{title}</h3>
      <p className="mt-2 text-ink-muted">{description}</p>
      {meta ? <div className="mt-3 text-ink">{meta}</div> : null}
    </Link>
  );
}

// ---------------------------------------------------------------------------

/**
 * Colour is never the only signal, so every badge carries its own words.
 * `tone` only changes the shade; the text is what says what happened.
 */
export function Badge({
  children,
  tone = "neutral",
}: {
  children: ReactNode;
  tone?: "neutral" | "positive" | "negative" | "accent";
}) {
  const tones = {
    neutral: "bg-surface-sunken text-ink border-line",
    positive: "bg-brand-soft text-brand border-brand",
    negative: "bg-accent-soft text-negative border-negative",
    accent: "bg-accent-soft text-accent border-accent",
  } as const;
  return (
    <span
      className={cn(
        "inline-block whitespace-nowrap rounded border px-2 py-0.5 text-base font-semibold",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------

export function Alert({
  title,
  children,
  tone = "info",
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning";
}) {
  return (
    <div
      role="status"
      className={cn(
        "rounded-card border-l-8 p-5",
        tone === "warning"
          ? "border-accent bg-accent-soft text-ink"
          : "border-brand bg-brand-soft text-ink",
      )}
    >
      {title ? <p className="text-lg font-bold">{title}</p> : null}
      <div className={title ? "mt-1" : undefined}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * The one-sentence plain-English explanation that sits above every table on
 * this site. A required prop rather than an optional one, so a new table
 * cannot quietly ship without its explanation.
 */
export function TableNote({ children }: { children: ReactNode }) {
  return <p className="mb-3 max-w-prose text-ink-muted">{children}</p>;
}

/**
 * Wide tables scroll inside their own box rather than making the page
 * scroll sideways — but only above 640px. Below that, pages hand a card
 * list to the reader instead of a table, which is why this wrapper is not
 * the answer to a narrow screen on its own.
 */
export function TableScroller({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-card border border-line bg-surface">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn("border-b-2 border-line px-3 py-3 font-bold text-ink", className)}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return <td className={cn("border-b border-line px-3 py-3 align-top", className)}>{children}</td>;
}

// ---------------------------------------------------------------------------

/**
 * The league audit found tooltips that only opened on hover and could not
 * be reached by touch at all. This is the replacement: an inline
 * disclosure, opened by click or by keyboard, that says what it will show
 * before you open it.
 */
export function Disclosure({ summary, children }: { summary: string; children: ReactNode }) {
  return (
    <Accordion.Root type="single" collapsible className="rounded-card border border-line bg-surface">
      <Accordion.Item value="item">
        <Accordion.Header>
          <Accordion.Trigger className="group flex min-h-touch w-full items-center justify-between gap-3 px-5 py-3 text-left text-lg font-semibold text-brand">
            {summary}
            <ChevronDown
              aria-hidden="true"
              className="size-6 shrink-0 transition-transform group-data-[state=open]:rotate-180"
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="border-t border-line px-5 py-4">{children}</Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

// ---------------------------------------------------------------------------

/** Markdown from Directus, at the site's measure and type scale. */
export function Prose({ markdown, className }: { markdown: string | null; className?: string }) {
  if (!markdown) return null;
  return (
    <div
      className={cn(
        "prose max-w-prose text-ink prose-headings:text-ink prose-a:text-brand prose-strong:text-ink",
        className,
      )}
    >
      <Markdown>{markdown}</Markdown>
    </div>
  );
}

// ---------------------------------------------------------------------------

/**
 * An empty state that says why it is empty and what to do instead. "No
 * results found" tells a reader nothing they did not already know.
 */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line bg-surface-sunken p-8 text-center">
      <p className="mx-auto max-w-prose text-ink-muted">{children}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

export function Loading({ what }: { what: string }) {
  return (
    <p role="status" className="py-8 text-ink-muted">
      Loading {what}…
    </p>
  );
}

/**
 * What a reader sees when a fetch fails. It says what happened, and gives
 * them somewhere to go — never a status code.
 */
export function ErrorNote({ what }: { what: string }) {
  return (
    <Alert tone="warning" title={`We couldn't load the ${what}.`}>
      <p>
        This is usually temporary. Try reloading the page in a moment. If it keeps happening, please{" "}
        <Link href="/contact" className="text-brand underline">
          let us know
        </Link>
        .
      </p>
    </Alert>
  );
}
