import { useCallback, useSyncExternalStore } from "react";

/**
 * The result-entry password, held for the length of a browser tab.
 *
 * `sessionStorage`, not `localStorage`: a shared committee laptop should
 * not stay signed in after the tab is closed, and this secret unlocks
 * writing results for the whole league. It is deliberately not a cookie
 * either — nothing here needs to be sent automatically with every
 * request, and a cookie that is would be one CSRF thought away from a
 * problem. It goes on the one header, on the handful of calls that need
 * it.
 *
 * This is a shared secret rather than accounts, which is what the league
 * itself uses for captains. It proves the caller knows the password and
 * nothing else; see `env.ADMIN_TOKEN`.
 */

const KEY = "hrc-admin-token";

const listeners = new Set<() => void>();

function read(): string | null {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    // Private browsing, or storage disabled. Signing in still works for
    // the life of the page; it just will not survive a reload.
    return null;
  }
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setAdminToken(token: string | null): void {
  try {
    if (token) sessionStorage.setItem(KEY, token);
    else sessionStorage.removeItem(KEY);
  } catch {
    // As above.
  }
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useAdminToken(): [string | null, (token: string | null) => void] {
  // `useSyncExternalStore` rather than state in a provider, so signing out
  // in one part of the screen is seen by every other part immediately.
  const token = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((next: string | null) => setAdminToken(next), []);
  return [token, set];
}

export interface AdminError {
  status: number;
  message: string;
}

/** A call that carries the password. Throws `AdminError` on anything but 2xx. */
export async function adminFetch<T>(
  path: string,
  token: string,
  init: { method?: string; body?: unknown } = {},
): Promise<T> {
  const response = await fetch(path, {
    method: init.method ?? "GET",
    headers: {
      "x-admin-token": token,
      ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
  };

  if (!response.ok) {
    throw {
      status: response.status,
      message: payload.message ?? "That did not work.",
    } satisfies AdminError;
  }
  return payload.data as T;
}

/** Reads a chosen file as base64, without the `data:` prefix the API does not want. */
export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("That file could not be read."));
    reader.onload = () => {
      const result = String(reader.result);
      const comma = result.indexOf(",");
      resolve(comma === -1 ? result : result.slice(comma + 1));
    };
    reader.readAsDataURL(file);
  });
}
