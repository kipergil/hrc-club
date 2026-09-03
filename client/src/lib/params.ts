import { useCallback } from "react";
import { useLocation, useSearch } from "wouter";

/**
 * One query-string filter, held in the URL rather than in component state.
 *
 * The URL is the right home for a filter on this site: it makes a filtered
 * view shareable — "here are Water Lane A's results" is a link somebody can
 * paste into an email — and it survives a reload, which local state does
 * not.
 *
 * `replace` rather than `push`, so flicking between filters does not fill
 * the back button with them. Back should leave the page, not undo a filter
 * one step at a time.
 */
export function useUrlParam(
  name: string,
): [string | undefined, (value: string | undefined) => void] {
  const search = useSearch();
  const [pathname, navigate] = useLocation();
  const value = new URLSearchParams(search).get(name) ?? undefined;

  const setValue = useCallback(
    (next: string | undefined) => {
      const params = new URLSearchParams(search);
      if (next) params.set(name, next);
      else params.delete(name);
      const query = params.toString();
      navigate(query ? `${pathname}?${query}` : pathname, { replace: true });
    },
    [name, navigate, pathname, search],
  );

  return [value, setValue];
}
