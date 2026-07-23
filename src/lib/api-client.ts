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

  if (!response.ok) await throwApiError(response, "POST", path);

  return (await response.json()) as T;
}

/**
 * Typed PUT against the backend, returning the saved resource.
 *
 * Used for idempotent writes such as saving a per-user table layout (LEAD-05.1),
 * where the same body re-sent produces the same state. Error handling matches
 * `apiPost`, so a rejected body surfaces the server's exact reason.
 */
export async function apiPut<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) await throwApiError(response, "PUT", path);

  return (await response.json()) as T;
}

/**
 * Typed PATCH against the backend, returning the updated resource.
 *
 * Used for a partial, idempotent field update such as a Kanban stage change
 * (KAN-04.1): dropping a card writes one field and re-sending is harmless. Error
 * handling matches `apiPost`, so a rejected move surfaces the server's exact
 * reason (400 invalid stage, 404 out of scope) for the caller to roll back on.
 */
export async function apiPatch<T>(
  path: string,
  body: unknown,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
    signal,
  });

  if (!response.ok) await throwApiError(response, "PATCH", path);

  return (await response.json()) as T;
}

/**
 * Typed DELETE against the backend, returning the server's confirmation body.
 *
 * Used for single-resource removal such as a row's delete action (LEAD-10.2),
 * where the id is in the path and there is no request body. Error handling
 * matches `apiPost`, so a 404 (out of scope / already gone) surfaces its reason.
 */
export async function apiDelete<T>(
  path: string,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "DELETE",
    headers: { Accept: "application/json" },
    signal,
  });

  if (!response.ok) await throwApiError(response, "DELETE", path);

  return (await response.json()) as T;
}

/**
 * Typed multipart POST for file uploads (LEAD-07.1 import).
 *
 * The Content-Type header is deliberately left unset: the browser must add it with
 * the multipart boundary, and setting it by hand breaks the upload. Error handling
 * matches `apiPost`, so a rejected file surfaces the server's exact reason.
 */
export async function apiPostForm<T>(
  path: string,
  form: FormData,
  signal?: AbortSignal,
): Promise<T> {
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "POST",
    headers: { Accept: "application/json" },
    body: form,
    signal,
  });

  if (!response.ok) await throwApiError(response, "POST", path);

  return (await response.json()) as T;
}

/** Reads a NestJS error body and throws a populated `ApiError`. Never returns. */
async function throwApiError(
  response: Response,
  method: string,
  path: string,
): Promise<never> {
  let messages: string[] = [];
  try {
    const data: unknown = await response.json();
    const raw = (data as { message?: unknown } | null)?.message;
    messages = Array.isArray(raw) ? raw.map(String) : raw ? [String(raw)] : [];
  } catch {
    // A non-JSON error body leaves messages empty; the status still surfaces.
  }
  throw new ApiError(
    response.status,
    messages[0] ?? `${method} ${path} failed with ${response.status}`,
    messages,
  );
}
