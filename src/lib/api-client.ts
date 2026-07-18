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
