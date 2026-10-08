import { BarChart3 } from "lucide-react";
import { useState } from "react";
import { Link } from "wouter";
import { CHART_GROUPS, STAT_CHARTS, availableIds, statsHref, type Evidence } from "@/lib/stat-charts";
import { cn } from "@/lib/utils";

/**
 * Pick the charts to draw.
 *
 * On a player's page it ends in a link to their statistics page with the
 * choice in the address; on the statistics page itself it ends in a
 * button that redraws. Either way nothing is fetched or drawn until the
 * reader asks — the point of having a separate page at all.
 *
 * A chart this player cannot have yet is listed but cannot be ticked,
 * with what it is waiting for, so the picker doubles as an honest list of
 * what the site can show.
 */
export function StatPicker({
  slug,
  evidence,
  initial,
  onApply,
}: {
  slug: string;
  evidence: Evidence;
  initial: string[];
  /** Given on the statistics page: apply there rather than navigate. */
  onApply?: (ids: string[]) => void;
}) {
  const available = new Set(availableIds(evidence));
  const [picked, setPicked] = useState<Set<string>>(() => new Set(initial.filter((id) => available.has(id))));
  const toggle = (id: string) =>
    setPicked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  // Catalogue order, whatever order they were ticked in.
  const ids = STAT_CHARTS.filter((chart) => picked.has(chart.id)).map((chart) => chart.id);
  const label = ids.length === 1 ? "Show 1 chart" : `Show ${ids.length} charts`;
  const action =
    "inline-flex min-h-touch items-center gap-2 rounded-card px-4 font-semibold no-underline transition-colors";

  return (
    <div className="space-y-6">
      {CHART_GROUPS.map((group) => (
        <fieldset key={group.id}>
          <legend className="text-lg font-semibold">{group.title}</legend>
          <p className="text-ink-muted">{group.blurb}</p>
          <ul className="mt-2 grid gap-2 md:grid-cols-2">
            {STAT_CHARTS.filter((chart) => chart.group === group.id).map((chart) => {
              const missing = chart.needs(evidence);
              const id = `chart-${chart.id}`;
              return (
                <li key={chart.id}>
                  <label
                    htmlFor={id}
                    className={cn(
                      "flex min-h-touch gap-3 rounded-card border px-3 py-2",
                      missing
                        ? "cursor-not-allowed border-line bg-surface-sunken text-ink-muted"
                        : "cursor-pointer border-line-strong bg-surface hover:border-brand",
                      picked.has(chart.id) && "border-brand bg-brand-soft",
                    )}
                  >
                    <input
                      id={id}
                      type="checkbox"
                      className="mt-1 size-5 shrink-0 accent-[rgb(var(--c-brand))]"
                      checked={picked.has(chart.id)}
                      disabled={missing !== null}
                      onChange={() => toggle(chart.id)}
                    />
                    <span>
                      <span className="block font-semibold">{chart.title}</span>
                      <span className="block text-ink-muted">
                        {missing ? `Not yet: ${missing}.` : chart.question}
                      </span>
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </fieldset>
      ))}

      <div className="flex flex-wrap items-center gap-3 no-print">
        {onApply ? (
          <button
            type="button"
            disabled={ids.length === 0}
            onClick={() => onApply(ids)}
            className={cn(action, "bg-brand text-brand-ink hover:bg-brand-strong disabled:opacity-50")}
          >
            <BarChart3 aria-hidden="true" className="size-5" />
            {label}
          </button>
        ) : ids.length > 0 ? (
          <Link href={statsHref(slug, ids)} className={cn(action, "bg-brand text-brand-ink hover:bg-brand-strong")}>
            <BarChart3 aria-hidden="true" className="size-5" />
            {label}
          </Link>
        ) : (
          <span className={cn(action, "bg-surface-sunken text-ink-muted")}>Tick a chart to show it</span>
        )}
        <button
          type="button"
          onClick={() => setPicked(new Set(available))}
          className={cn(action, "border border-line-strong bg-surface text-ink hover:border-brand")}
        >
          Tick all {available.size}
        </button>
        {picked.size > 0 ? (
          <button type="button" onClick={() => setPicked(new Set())} className="link min-h-touch font-semibold">
            Clear
          </button>
        ) : null}
      </div>
    </div>
  );
}
