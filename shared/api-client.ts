/**
 * The one place a URL is built and a response is unwrapped.
 *
 * Every endpoint replies `{ data: ... }` on success and
 * `{ message: string }` on failure, so the client never has to guess which
 * shape it is holding, and an error carries a sentence a person can read
 * rather than a status code.
 */

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Absolute during prerendering (no origin to be relative to), relative in
 * the browser (so the site works on any domain, preview deploys included).
 */
export function apiBase(): string {
  if (typeof window === "undefined") {
    return process.env.PRERENDER_API_BASE ?? "http://localhost:5000";
  }
  return "";
}

export async function apiGet<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiBase()}${path}`, {
    credentials: "same-origin",
    ...init,
  });

  const body = (await response.json().catch(() => null)) as
    | { data?: T; message?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.message ?? "Something went wrong at our end. Please try again in a moment.",
      response.status,
    );
  }

  return body?.data as T;
}

export async function apiPost<TResponse, TBody>(path: string, payload: TBody): Promise<TResponse> {
  const response = await fetch(`${apiBase()}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(payload),
  });

  const body = (await response.json().catch(() => null)) as
    | { data?: TResponse; message?: string }
    | null;

  if (!response.ok) {
    throw new ApiError(
      body?.message ?? "We couldn't send that. Please try again in a moment.",
      response.status,
    );
  }

  return body?.data as TResponse;
}
