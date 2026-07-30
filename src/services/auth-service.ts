import { apiPost } from "@/lib/api-client";

/**
 * The authentication client (AUTH-01.6 foundation). Thin typed wrappers over the auth
 * endpoints built in AUTH-01.2/01.3/01.5. Tokens are set and cleared by the server as
 * HttpOnly cookies — nothing here reads or stores a token; these calls only send the
 * cookies (the api-client uses `credentials: "include"`) and return the user profile.
 */

/** The signed-in user profile the auth endpoints return (never includes secrets). */
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  /** Backend `UserRole` value; typed loosely until role-based UI lands (AUTH-02.2). */
  role: string;
}

interface SessionResponse {
  user: AuthUser;
}

/** Verifies credentials; on success the backend sets the session cookies (AUTH-01.2). */
export async function login(
  credentials: { email: string; password: string },
  signal?: AbortSignal,
): Promise<AuthUser> {
  const { user } = await apiPost<SessionResponse>(
    "/auth/login",
    credentials,
    signal,
  );
  return user;
}

/**
 * Silently renews the session from the refresh cookie (AUTH-01.3) and returns the current
 * user. Used to restore a session on app load: the access cookie is short-lived, so a
 * reload relies on the long-lived refresh cookie to mint a fresh one. Throws `ApiError`
 * (401) when there is no valid session — the caller reads that as "not logged in".
 */
export async function fetchSession(signal?: AbortSignal): Promise<AuthUser> {
  const { user } = await apiPost<SessionResponse>("/auth/refresh", {}, signal);
  return user;
}

/** Ends the session server-side and clears the cookies (AUTH-01.5). Idempotent. */
export async function logout(signal?: AbortSignal): Promise<void> {
  await apiPost<{ success: true }>("/auth/logout", {}, signal);
}
