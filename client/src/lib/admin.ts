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

/**
 * Who is entering the card, and the password that lets them.
 *
 * The password is the gate and always has been. The email is not a second
 * password — anyone holding the shared password could type anybody's — it
 * is an *identification*, checked against the members the committee has
 * ticked as able to enter results. What that buys is worth having and
 * worth being honest about: every saved card says who saved it, and a
 * captain who leaves the committee can be turned off on their own record
 * without changing the password every other captain is using.
 */
export interface AdminSession {
  email: string;
  password: string;
}

const listeners = new Set<() => void>();

/*
 * Parsed once per read and cached, because `useSyncExternalStore` compares
 * snapshots by identity: parsing afresh on every call returns a new object
 * every time, React sees the store as perpetually changed, and the page
 * re-renders in a loop until the tab gives up.
 */
let cachedRaw: string | null = null;
let cachedSession: AdminSession | null = null;

function read(): AdminSession | null {
  let raw: string | null;
  try {
    raw = sessionStorage.getItem(KEY);
  } catch {
    // Private browsing, or storage disabled. Signing in still works for
    // the life of the page; it just will not survive a reload.
    return null;
  }

  if (raw === cachedRaw) return cachedSession;
  cachedRaw = raw;
  cachedSession = null;
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as Partial<AdminSession>;
      if (typeof parsed?.email === "string" && typeof parsed?.password === "string") {
        cachedSession = { email: parsed.email, password: parsed.password };
      }
    } catch {
      // A value from an older version of this page, or a corrupted one.
      // Signing in again is the whole recovery.
    }
  }
  return cachedSession;
}

function emit(): void {
  for (const listener of listeners) listener();
}

export function setAdminSession(session: AdminSession | null): void {
  try {
    if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
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

export function useAdminSession(): [AdminSession | null, (next: AdminSession | null) => void] {
  // `useSyncExternalStore` rather than state in a provider, so signing out
  // in one part of the screen is seen by every other part immediately.
  const session = useSyncExternalStore(subscribe, read, () => null);
  const set = useCallback((next: AdminSession | null) => setAdminSession(next), []);
  return [session, set];
}

export interface AdminError {
  status: number;
  message: string;
}

/**
 * How long a call may run before it is given up on.
 *
 * Reading a card is a photograph going to a vision model and a structured
 * card coming back; twenty to forty seconds is ordinary and a slow one is
 * longer. Everything else on this screen is a small JSON round trip. One
 * timeout for both would either abandon a perfectly healthy parse or leave
 * somebody watching a spinner for two minutes because a lookup is wedged.
 */
export const ADMIN_TIMEOUT_MS = 20_000;
export const PARSE_TIMEOUT_MS = 150_000;

/**
 * A call that carries the session. Throws `AdminError` on anything but 2xx.
 *
 * The two non-HTTP failures get their own statuses and their own words,
 * because to the person holding the card they are different situations and
 * "That did not work" is the wrong answer to both. `408` is the wait
 * running out; `0` is the request never completing — a dropped signal in a
 * sports hall, most often.
 */
export async function adminFetch<T>(
  path: string,
  session: AdminSession,
  init: { method?: string; body?: unknown; timeoutMs?: number; signal?: AbortSignal } = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort("timeout"), init.timeoutMs ?? ADMIN_TIMEOUT_MS);
  // A caller that wants to cancel — the reader pressing Stop — aborts its
  // own signal, and this one follows.
  const onAbort = () => controller.abort("cancelled");
  init.signal?.addEventListener("abort", onAbort, { once: true });

  let response: Response;
  try {
    response = await fetch(path, {
      method: init.method ?? "GET",
      headers: {
        "x-admin-token": session.password,
        "x-admin-email": session.email,
        ...(init.body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
      signal: controller.signal,
    });
  } catch (caught) {
    if (controller.signal.aborted && controller.signal.reason === "cancelled") {
      throw { status: 499, message: "Stopped." } satisfies AdminError;
    }
    if (controller.signal.aborted) {
      throw {
        status: 408,
        message:
          "That took longer than expected and was given up on. The card may still be large — try again, and if it keeps happening you can type this one in instead.",
      } satisfies AdminError;
    }
    throw {
      status: 0,
      message:
        "The connection dropped before that finished. Check your signal and try again — nothing has been saved.",
    } satisfies AdminError;
  } finally {
    clearTimeout(timeout);
    init.signal?.removeEventListener("abort", onAbort);
  }

  const payload = (await response.json().catch(() => ({}))) as {
    data?: T;
    message?: string;
  };

  if (!response.ok) {
    throw {
      status: response.status,
      /*
       * A body too large is rejected at the edge, before this app sees it,
       * so there is no message of ours to show — and the bare status would
       * read as "that did not work" for a reason nobody could guess.
       */
      message:
        payload.message ??
        (response.status === 413
          ? "That photograph is too large to send. Try again — it is resized before sending, so this usually means the resizing did not run."
          : "That did not work."),
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
