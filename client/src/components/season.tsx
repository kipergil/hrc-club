import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import type { Season } from "@shared/types.js";
import { FilterChips } from "@/components/ui";

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
  const search = useSearch();
  const [pathname, navigate] = useLocation();
  const season = new URLSearchParams(search).get("season") ?? undefined;

  const setSeason = useCallback(
    (next: string | undefined) => {
      const params = new URLSearchParams(search);
      if (next) params.set("season", next);
      else params.delete("season");
      const query = params.toString();
      // `replace` so that flicking between years does not fill the back
      // button with them — back should leave the page, not undo a filter.
      navigate(query ? `${pathname}?${query}` : pathname, { replace: true });
    },
    [navigate, pathname, search],
  );

  return [season, setSeason];
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
  // One season is not a choice, and a filter offering it is just furniture.
  if (!seasons || seasons.length < 2) return null;

  const current = seasons.find((season) => season.isCurrent);

  return (
    <FilterChips
      label={label}
      value={value ?? current?.slug ?? seasons[0]!.slug}
      onChange={(next) => onChange(next === current?.slug ? undefined : next)}
      options={seasons.map((season) => ({
        value: season.slug,
        label: season.isCurrent ? `${season.label} (current)` : season.label,
      }))}
    />
  );
}
