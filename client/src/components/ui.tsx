import * as Accordion from "@radix-ui/react-accordion";
import { ChevronDown, Search, X } from "lucide-react";
import { useId, type ReactNode } from "react";
import Markdown from "react-markdown";
import { Link } from "wouter";
import { cn } from "@/lib/utils";

/**
 * The site's whole component vocabulary, in one file.
 *
 * A club site maintained by volunteers should not carry a component
 * library it uses a tenth of. The accessibility rules that would otherwise
 * be repeated at every call site — 48px targets, no hover-only
 * affordances, text labels beside every colour — live here instead, so a
 * new page gets them by using the vocabulary rather than by remembering
 * the rules.
 */

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------

type ButtonVariant = "primary" | "secondary" | "quiet" | "danger";
type ButtonSize = "md" | "sm";

/*
 * Every variant moves on hover *and* on active, and none of them signals
 * anything by colour alone. The `active:` step matters more than it looks:
 * on a touch screen there is no hover, so the press state is the only
 * feedback a tap ever gets.
 */
const buttonBase =
  "inline-flex min-h-touch select-none items-center justify-center gap-2 rounded-card font-semibold no-underline " +
  "transition-[background-color,border-color,color,box-shadow,transform] duration-150 " +
  "active:translate-y-px disabled:pointer-events-none disabled:opacity-55";

const buttonSizes: Record<ButtonSize, string> = {
  md: "px-5 py-3 text-base",
  sm: "px-4 py-2 text-base",
};

const buttonVariants: Record<ButtonVariant, string> = {
  primary: "bg-brand text-brand-ink shadow-raised hover:bg-brand-strong hover:shadow-card",
  secondary:
    "border border-line-strong bg-surface text-ink shadow-raised hover:border-brand hover:bg-brand-soft hover:text-brand",
  quiet: "text-brand hover:bg-brand-soft",
  danger: "border border-negative bg-surface text-negative hover:bg-negative-soft",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
}) {
  return (
    <button
      className={cn(buttonBase, buttonSizes[size], buttonVariants[variant], className)}
      {...props}
    />
  );
}

/** An internal link that looks like a button. Still a link, so it still opens in a new tab on middle-click. */
export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  className,
  children,
}: {
  href: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cn(buttonBase, buttonSizes[size], buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------

export function Card({
  className,
  children,
  as: As = "div",
}: {
  className?: string;
  children: ReactNode;
  as?: "div" | "article" | "section";
}) {
  return (
    <As className={cn("rounded-card border border-line bg-surface p-5 shadow-card print-plain", className)}>
      {children}
    </As>
  );
}

/**
 * A whole card that is one big link — the home page's destinations.
 *
 * The hover state moves the border and lifts the shadow rather than
 * repainting the whole card in brand-soft, which at card size was a large
 * green flash under the pointer. The title carries the underline because
 * it is the link text; the card is the target.
 */
export function CardLink({
  href,
  title,
  description,
  meta,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  meta?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "group flex h-full flex-col rounded-card border border-line bg-surface p-5 no-underline shadow-card",
        "transition-[border-color,box-shadow,transform] duration-150",
        "hover:-translate-y-0.5 hover:border-brand hover:shadow-lifted active:translate-y-0",
      )}
    >
      {icon ? (
        <span
          aria-hidden="true"
          className="mb-3 inline-flex size-11 items-center justify-center rounded-card bg-brand-soft text-brand transition-colors group-hover:bg-brand group-hover:text-brand-ink"
        >
          {icon}
        </span>
      ) : null}
      <h3 className="text-xl text-brand underline decoration-brand/40 underline-offset-4 group-hover:decoration-brand">
        {title}
      </h3>
      <p className="mt-1.5 text-ink-muted">{description}</p>
      {meta ? (
        <p className="mt-auto pt-3 font-semibold tabular text-ink">{meta}</p>
      ) : null}
    </Link>
  );
}

/**
 * A quieter grouping than `Card` for a block that is part of the page
 * rather than an item in a list — a filter bar, a summary strip.
 */
export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return (
    <div className={cn("rounded-panel border border-line bg-surface-sunken p-4", className)}>
      {children}
    </div>
  );
}

/**
 * One number and its label. Used where a page opens on a figure worth
 * knowing — how many clubs, how many results, how far back the record
 * goes — so a reader gets the shape of the page before its detail.
 *
 * It renders as a `<div>` wrapping a `<dt>`/`<dd>` pair, which is the one
 * arrangement a description list permits between `<dl>` and its terms, so
 * a row of these is a real description list rather than a grid of divs
 * that merely looks like one.
 */
export function Stat({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-card border border-line bg-surface px-4 py-3 shadow-raised print-plain">
      {/* Value first visually, label first in the DOM order that matters:
          `dt` is the term, so it is read before the number it describes. */}
      <dd className="text-2xl font-semibold tabular text-ink">{value}</dd>
      <dt className="mt-0.5 text-ink-muted">{label}</dt>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Status
// ---------------------------------------------------------------------------

type Tone = "neutral" | "positive" | "negative" | "accent" | "brand";

/**
 * Colour is never the only signal, so every badge carries its own words.
 * `tone` only changes the shade; the text is what says what happened.
 */
export function Badge({
  children,
  tone = "neutral",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const tones: Record<Tone, string> = {
    neutral: "border-line-strong bg-surface-sunken text-ink",
    positive: "border-positive/35 bg-positive-soft text-positive",
    // Previously this paired an *accent* background with negative text,
    // so a loss rendered as red-on-orange.
    negative: "border-negative/35 bg-negative-soft text-negative",
    accent: "border-accent/35 bg-accent-soft text-accent",
    brand: "border-brand/35 bg-brand-soft text-brand",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-md border px-2 py-0.5 font-semibold",
        tones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Alert({
  title,
  children,
  tone = "info",
  className,
}: {
  title?: string;
  children: ReactNode;
  tone?: "info" | "warning" | "error" | "success";
  className?: string;
}) {
  const tones = {
    info: "border-brand/30 bg-brand-soft",
    warning: "border-accent/30 bg-accent-soft",
    error: "border-negative/30 bg-negative-soft",
    success: "border-positive/30 bg-positive-soft",
  } as const;

  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-card border p-5 text-ink", tones[tone], className)}
    >
      {title ? <p className="text-lg font-semibold">{title}</p> : null}
      <div className={cn(title && "mt-1")}>{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tables
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
    <div className="overflow-x-auto rounded-card border border-line bg-surface shadow-card print-plain">
      <table className="w-full border-collapse text-left">{children}</table>
    </div>
  );
}

export function Th({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <th
      scope="col"
      className={cn(
        "border-b border-line bg-surface-sunken px-4 py-3 font-semibold text-ink first:rounded-tl-card last:rounded-tr-card",
        className,
      )}
    >
      {children}
    </th>
  );
}

export function Td({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <td className={cn("border-b border-line px-4 py-3 align-middle", className)}>{children}</td>
  );
}

/** A body row with the site's hover treatment. `highlight` tints it for good. */
export function Tr({
  children,
  highlight = false,
  className,
}: {
  children: ReactNode;
  highlight?: boolean;
  className?: string;
}) {
  return (
    <tr
      className={cn(
        "transition-colors last:[&>td]:border-b-0",
        highlight ? "bg-brand-soft" : "hover:bg-surface-sunken",
        className,
      )}
    >
      {children}
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Disclosure
// ---------------------------------------------------------------------------

/**
 * The league audit found tooltips that only opened on hover and could not
 * be reached by touch at all. This is the replacement: an inline
 * disclosure, opened by click or by keyboard, that says what it will show
 * before you open it.
 */
export function Disclosure({
  summary,
  meta,
  children,
  defaultOpen = false,
}: {
  summary: string;
  meta?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
}) {
  return (
    <Accordion.Root
      type="single"
      collapsible
      defaultValue={defaultOpen ? "item" : undefined}
      className="overflow-hidden rounded-card border border-line bg-surface shadow-raised print-plain"
    >
      <Accordion.Item value="item">
        <Accordion.Header>
          <Accordion.Trigger className="group flex min-h-touch w-full items-center justify-between gap-3 px-5 py-3 text-left text-lg font-semibold text-brand transition-colors hover:bg-brand-soft">
            <span>
              {summary}
              {meta ? <span className="ml-2 font-normal text-ink-muted">{meta}</span> : null}
            </span>
            <ChevronDown
              aria-hidden="true"
              className="size-6 shrink-0 text-ink-muted transition-transform duration-200 group-data-[state=open]:rotate-180"
            />
          </Accordion.Trigger>
        </Accordion.Header>
        <Accordion.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
          <div className="border-t border-line px-5 py-4">{children}</div>
        </Accordion.Content>
      </Accordion.Item>
    </Accordion.Root>
  );
}

// ---------------------------------------------------------------------------
// Form controls
// ---------------------------------------------------------------------------

const fieldBase =
  "w-full rounded-card border bg-surface px-4 py-3 text-base text-ink shadow-raised " +
  "transition-[border-color,box-shadow] placeholder:text-ink-muted/70 " +
  "disabled:cursor-not-allowed disabled:bg-surface-sunken disabled:opacity-60";

/**
 * A labelled field.
 *
 * The label, the hint and the error are one component because the wiring
 * between them is the part that gets forgotten: `aria-describedby` has to
 * name both the hint and the error, and `aria-invalid` has to be set, or a
 * screen-reader user hears the label and nothing else. Doing it here means
 * a page cannot get it wrong by writing the markup out by hand.
 */
export function Field({
  label,
  hint,
  error,
  required = false,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  required?: boolean;
  children: (props: {
    id: string;
    "aria-describedby": string | undefined;
    "aria-invalid": boolean | undefined;
    "aria-required": boolean | undefined;
    className: string;
  }) => ReactNode;
}) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const describedBy = [hintId, errorId].filter(Boolean).join(" ") || undefined;

  return (
    <div>
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
        {/* Marked in words, because an asterisk is a convention people are
            assumed to know and many readers do not. */}
        {required ? null : <span className="ml-2 font-normal text-ink-muted">(optional)</span>}
      </label>
      {hint ? (
        <p id={hintId} className="mt-0.5 text-ink-muted">
          {hint}
        </p>
      ) : null}
      <div className="mt-2">
        {children({
          id,
          "aria-describedby": describedBy,
          "aria-invalid": error ? true : undefined,
          "aria-required": required || undefined,
          className: cn(
            fieldBase,
            error
              ? "border-negative focus:border-negative"
              : "border-line-strong hover:border-ink-muted focus:border-brand",
          ),
        })}
      </div>
      {error ? (
        <p id={errorId} className="mt-2 flex items-start gap-2 font-semibold text-negative">
          {/* A word, not only a red border. */}
          <span aria-hidden="true">⚠</span>
          <span>{error}</span>
        </p>
      ) : null}
    </div>
  );
}

/**
 * The search box that sits above the site's long lists.
 *
 * Controlled, labelled, and clearable — the clear button is a real button
 * rather than the browser's own `type="search"` cross, which is invisible
 * to touch on several mobile browsers and unstyleable on the rest.
 */
export function SearchBox({
  value,
  onChange,
  label,
  placeholder,
  resultCount,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder?: string;
  /** Announced politely as the reader types, so the count is not silent. */
  resultCount?: { shown: number; total: number; noun: string };
  className?: string;
}) {
  const id = useId();

  return (
    <div className={cn("no-print", className)}>
      <label htmlFor={id} className="block font-semibold text-ink">
        {label}
      </label>
      <div className="relative mt-2 max-w-prose">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-ink-muted"
        />
        <input
          id={id}
          type="text"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="off"
          className={cn(fieldBase, "border-line-strong pl-12 pr-12 hover:border-ink-muted focus:border-brand")}
        />
        {value ? (
          <button
            type="button"
            onClick={() => onChange("")}
            className="absolute right-2 top-1/2 flex size-9 -translate-y-1/2 items-center justify-center rounded-card text-ink-muted transition-colors hover:bg-surface-sunken hover:text-ink"
          >
            <X aria-hidden="true" className="size-5" />
            <span className="sr-only">Clear the search box</span>
          </button>
        ) : null}
      </div>
      {resultCount ? (
        <p role="status" aria-live="polite" className="mt-2 text-ink-muted">
          {resultCount.shown === resultCount.total
            ? `${resultCount.total} ${resultCount.noun}`
            : `${resultCount.shown} of ${resultCount.total} ${resultCount.noun}`}
        </p>
      ) : null}
    </div>
  );
}

/**
 * A row of filter buttons — a real toggle group, not a `<select>`, because
 * on a phone a select opens a modal wheel for what is usually a choice
 * between three divisions.
 */
export function FilterChips<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: ReadonlyArray<{ value: T; label: string; count?: number }>;
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="no-print" role="group" aria-label={label}>
      <p className="font-semibold text-ink">{label}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {options.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={cn(
                "inline-flex min-h-touch items-center gap-2 rounded-card border px-4 font-semibold transition-colors",
                selected
                  ? "border-brand bg-brand text-brand-ink"
                  : "border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft hover:text-brand",
              )}
            >
              {option.label}
              {option.count === undefined ? null : (
                <span className={cn("tabular", selected ? "text-brand-ink/80" : "text-ink-muted")}>
                  {option.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Content
// ---------------------------------------------------------------------------

/** Markdown from Directus, at the site's measure and type scale. */
export function Prose({ markdown, className }: { markdown: string | null; className?: string }) {
  if (!markdown) return null;
  return (
    <div
      className={cn(
        "prose max-w-prose text-ink",
        "prose-headings:text-ink prose-headings:font-semibold",
        "prose-p:text-ink prose-li:text-ink prose-strong:text-ink",
        "prose-a:text-brand prose-a:underline prose-a:underline-offset-4",
        "prose-blockquote:border-l-brand prose-blockquote:text-ink-muted",
        className,
      )}
    >
      <Markdown>{markdown}</Markdown>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Empty, loading and error states
// ---------------------------------------------------------------------------

/**
 * An empty state that says why it is empty and what to do instead. "No
 * results found" tells a reader nothing they did not already know.
 */
export function Empty({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="rounded-card border border-dashed border-line-strong bg-surface-sunken p-8 text-center">
      <p className="mx-auto max-w-prose text-ink-muted">{children}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

/** A grey block standing in for content that has not arrived. */
export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton h-5 w-full", className)} />;
}

/**
 * The loading state, shaped like the thing it is loading.
 *
 * The old one was a line of text reading "Loading the roll of honour…",
 * which meant every page snapped from one line to a full screen of content
 * and threw the reader's eye away. These hold roughly the right amount of
 * space so the page does not jump when the data lands.
 *
 * The text is still there for screen readers — `role="status"` on a
 * container whose visible content is decorative.
 */
export function Loading({ what, variant = "list" }: { what: string; variant?: "list" | "table" | "cards" | "page" }) {
  return (
    <div role="status" aria-live="polite" className="py-2">
      <span className="sr-only">Loading {what}…</span>

      {variant === "page" ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-2/3 max-w-md" />
          <Skeleton className="h-6 w-1/2 max-w-sm" />
          <div className="space-y-3 pt-4">
            <Skeleton />
            <Skeleton className="w-11/12" />
            <Skeleton className="w-4/5" />
          </div>
        </div>
      ) : null}

      {variant === "table" ? (
        <div className="overflow-hidden rounded-card border border-line bg-surface">
          <div className="border-b border-line bg-surface-sunken px-4 py-3">
            <Skeleton className="h-5 w-40 bg-line" />
          </div>
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="flex items-center gap-4 border-b border-line px-4 py-4 last:border-b-0">
              <Skeleton className="h-5 w-8 shrink-0" />
              <Skeleton className="h-5 flex-1" />
              <Skeleton className="h-5 w-16 shrink-0" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "cards" ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="rounded-card border border-line bg-surface p-5">
              <Skeleton className="h-6 w-3/5" />
              <Skeleton className="mt-3 h-5" />
              <Skeleton className="mt-2 h-5 w-4/5" />
            </div>
          ))}
        </div>
      ) : null}

      {variant === "list" ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }, (_, index) => (
            <div key={index} className="rounded-card border border-line bg-surface p-5">
              <Skeleton className="h-6 w-1/2" />
              <Skeleton className="mt-3 h-5 w-3/4" />
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

/**
 * What a reader sees when a fetch fails. It says what happened, and gives
 * them somewhere to go — never a status code.
 */
export function ErrorNote({ what }: { what: string }) {
  return (
    <Alert tone="error" title={`We couldn't load the ${what}.`}>
      <p>
        This is usually temporary. Try reloading the page in a moment. If it keeps happening, please{" "}
        <Link href="/contact" className="link font-semibold">
          let us know
        </Link>
        .
      </p>
    </Alert>
  );
}
