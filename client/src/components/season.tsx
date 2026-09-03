import { useState } from "react";
import type { Season } from "@shared/types.js";
import { FilterChips } from "@/components/ui";
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
 * The year filter.
 *
 * Chips rather than a `<select>`: there are a handful of seasons, they are
 * the primary control on the page, and on a phone a select opens a modal
 * wheel for what should be one tap.
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
  const [showAll, setShowAll] = useState(false);

  // One season is not a choice, and a filter offering it is just furniture.
  if (!seasons || seasons.length < 2) return null;

  const current = seasons.find((season) => season.isCurrent);
  const selected = value ?? current?.slug ?? seasons[0]!.slug;

  /*
   * This was written for the four or five seasons the site held, and the
   * league's archive turned out to go back to 2011-12. Sixteen chips wrap
   * onto two rows and push the table itself below the fold — the filter
   * ends up larger than the thing it filters.
   *
   * So: the recent seasons stay one tap away, and the rest are one tap
   * behind a button. `RECENT` is six because "this season" and "last
   * season" are what nearly every visit wants, and a couple either side
   * covers the rest without a second row.
   */
  const RECENT = 6;
  const collapsed = seasons.length > RECENT + 2 && !showAll;
  // A season chosen from the archive stays visible while it is selected —
  // otherwise picking 2013-14 makes the chip you just pressed disappear.
  const shown = collapsed
    ? seasons.filter((season, index) => index < RECENT || season.slug === selected)
    : seasons;

  return (
    <div className="space-y-2">
      <FilterChips
        label={label}
        value={selected}
        onChange={(next) => onChange(next === current?.slug ? undefined : next)}
        options={shown.map((season) => ({
          value: season.slug,
          label: season.isCurrent ? `${season.label} (current)` : season.label,
        }))}
      />
      {collapsed ? (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="link no-print min-h-touch font-semibold"
        >
          Show all {seasons.length} seasons, back to {seasons[seasons.length - 1]!.label}
        </button>
      ) : null}
    </div>
  );
}
