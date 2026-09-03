import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import type { Season } from "@shared/types.js";
import { cn } from "@/lib/utils";
import { useUrlParam } from "@/lib/params";

/**
 * The season a page is showing, held in the URL.
 *
 * In the query string rather than in component state, because a league
 * table for a particular year is a thing people send each other. The old
 * site solved the same problem with a file per year — `Tables2025.htm`,
 * `Tables2024.htm` — and the one property of that worth keeping is that
 * the address names what you are looking at.
 *
 * Absent means the current season, which keeps `/tables` the address of
 * the table anyone means when they do not say.
 */
export function useSeasonParam(): [string | undefined, (season: string | undefined) => void] {
  return useUrlParam("season");
}

/**
 * The year filter: this season, and everything else behind one button.
 *
 * The league's archive goes back to 2011-12, and laying that out as chips
 * put sixteen buttons above every table — two wrapped rows of furniture
 * ahead of the thing they filter, on a page whose subject is the table.
 * Nearly every visit wants this season or last season; the other fourteen
 * are worth keeping and not worth the space.
 *
 * So the current season stays visible as a chip, and the rest live in a
 * popover. When an earlier season is chosen the button takes its name, so
 * the control always says which year you are looking at rather than
 * leaving you to infer it from the page.
 */
export function SeasonPicker({
  seasons,
  value,
  onChange,
  label = "Season",
}: {
  seasons: Season[] | undefined;
  value: string | undefined;
  onChange: (season: string | undefined) => void;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  /*
   * Escape and a click outside both close it, and Escape puts focus back
   * on the button — a popover you can open with the keyboard and not
   * close with it is a trap. The listeners exist only while it is open,
   * so a page with a closed picker has none.
   */
  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      buttonRef.current?.focus();
    }
    function onPointerDown(event: PointerEvent) {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    }

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [open]);

  // One season is not a choice, and a filter offering it is just furniture.
  if (!seasons || seasons.length < 2) return null;

  const current = seasons.find((season) => season.isCurrent) ?? seasons[0]!;
  const selected = value ?? current.slug;
  const earlier = seasons.filter((season) => season.slug !== current.slug);
  const selectedEarlier = earlier.find((season) => season.slug === selected);

  function choose(season: Season) {
    // The current season is the bare URL, so selecting it clears the param
    // rather than writing `?season=` for the default view.
    onChange(season.slug === current.slug ? undefined : season.slug);
    setOpen(false);
    buttonRef.current?.focus();
  }

  /*
   * `whitespace-nowrap` and tighter padding below 640px: at 360 the chip
   * broke "2026-27 (current)" across two lines, which made it taller than
   * the control beside it and read as a mistake rather than a filter.
   */
  const chipBase =
    "inline-flex min-h-touch items-center gap-1.5 whitespace-nowrap rounded-card border px-3 font-semibold transition-colors sm:px-4";
  const chipSelected = "border-brand bg-brand text-brand-ink";
  const chipIdle =
    "border-line-strong bg-surface text-ink hover:border-brand hover:bg-brand-soft hover:text-brand";

  return (
    <div className="no-print" role="group" aria-label={label}>
      <p className="font-semibold text-ink">{label}</p>
      {/*
        The current season on the left, the way back on the right. They are
        not two equal choices: one is the season nearly every visit wants,
        and the other is a door to fifteen more. Sitting them side by side
        as matching chips gave the archive the same weight as this year and
        made the pair wide enough to wrap on a phone.
      */}
      <div className="mt-2 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => choose(current)}
          aria-pressed={selected === current.slug}
          /*
           * The name stays whole however narrow the screen gets, so what a
           * screen reader announces does not depend on the viewport.
           */
          aria-label={`${current.label} (current season)`}
          className={cn(chipBase, selected === current.slug ? chipSelected : chipIdle)}
        >
          {current.label}
          {/*
            "(current)" is the widest part of this chip and the first thing
            to go when there is no room. With an earlier season chosen the
            right-hand pill is showing that year, so the left one being the
            current season is the only thing it can be.
          */}
          <span className="hidden sm:inline">(current)</span>
        </button>

        <div className="relative shrink-0" ref={containerRef}>
          <button
            ref={buttonRef}
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls={panelId}
            /*
             * The visible word is short because the "Season" label and the
             * current-season chip beside it supply the context a sighted
             * reader has. Announced on its own, "Earlier" supplies none —
             * hence the fuller name here.
             */
            aria-label={
              selectedEarlier
                ? `${selectedEarlier.label} — choose another season`
                : "Earlier seasons"
            }
            /*
             * Quieter and narrower than the chip beside it, but still
             * min-h-touch: this site's readers are mostly over sixty, so
             * "smaller" is allowed to mean less ink and never a smaller
             * thing to hit.
             */
            className={cn(
              "inline-flex min-h-touch items-center gap-1 rounded-card border px-2.5 transition-colors",
              selectedEarlier
                ? "border-brand/40 bg-brand-soft font-semibold text-brand"
                : "border-transparent text-ink-muted hover:border-line-strong hover:bg-surface hover:text-ink",
            )}
          >
            {/*
              The button carries the selection when one is made, so the
              chosen year is never hidden inside a closed popover.
            */}
            {selectedEarlier ? selectedEarlier.label : "Earlier"}
            <ChevronDown
              aria-hidden="true"
              className={cn("size-4 transition-transform", open && "rotate-180")}
            />
          </button>

          {open ? (
            <div
              id={panelId}
              /* Anchored right, because the button now sits at the right
                 edge — a left-anchored panel would hang off the screen. */
              className="absolute right-0 z-30 mt-2 max-h-80 w-56 overflow-y-auto rounded-card border border-line-strong bg-surface p-1.5 shadow-lifted"
            >
              <p className="px-2.5 py-1.5 text-ink-muted">
                Back to {earlier[earlier.length - 1]!.label}
              </p>
              <ul>
                {earlier.map((season) => {
                  const isSelected = season.slug === selected;
                  return (
                    <li key={season.slug}>
                      <button
                        type="button"
                        onClick={() => choose(season)}
                        aria-current={isSelected ? "true" : undefined}
                        className={cn(
                          "flex min-h-touch w-full items-center justify-between gap-2 rounded-card px-2.5 text-left font-semibold transition-colors",
                          isSelected
                            ? "bg-brand-soft text-brand"
                            : "text-ink hover:bg-brand-soft hover:text-brand",
                        )}
                      >
                        {season.label}
                        {isSelected ? <Check aria-hidden="true" className="size-5" /> : null}
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
