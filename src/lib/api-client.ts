import { env } from "@/lib/env";

/**
 * A non-2xx response from the API.
 *
 * Carries the status so a caller can distinguish "not allowed" from "not
 * reachable" without parsing a message string.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    /** Field-level validation messages from the API (class-validator returns a list). */
    readonly messages: string[] = [],
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Typed GET against the backend (frontend rule: data fetching goes through a
 * typed client, base URL from NEXT_PUBLIC_API_BASE_URL via `env`).
 *
 * Takes an AbortSignal so a caller can cancel a request that a newer one has
 * superseded — the list refetches on every page change, and a slow earlier
 * response must not overwrite a newer page.
 */
export async function apiGet<T>(
  path: string,
  params?: URLSearchParams,
  signal?: AbortSignal,
): Promise<T> {
  const query = params && [...params.keys()].length > 0 ? `?${params}` : "";

  const response = await fetch(`${env.apiBaseUrl}${path}${query}`, {
    method: "GET",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) {
    throw new ApiError(
      response.status,
      `GET ${path} failed with ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

/**
 * Typed POST against the backend, returning the created resource.
 *
 * On a non-2xx it throws an `ApiError` carrying the API's validation messages —
 * NestJS returns `message` as a string or a string array — so a caller can show
 * exactly what the server rejected rather than a generic failure.
 */
export async function apiPost<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) {
    let messages: string[] = [];
    try {
      const data: unknown = await response.json();
      const raw = (data as { message?: unknown } | null)?.message;
      messages = Array.isArray(raw)
        ? raw.map(String)
        : raw
          ? [String(raw)]
          : [];
    } catch {
      // A non-JSON error body leaves messages empty; the status still surfaces.
    }
    throw new ApiError(
      response.status,
      messages[0] ?? `POST ${path} failed with ${response.status}`,
      messages,
    );
  }

  return (await response.json()) as T;
}
