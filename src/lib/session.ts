/**
 * Session bridge between the stateless api-client and the React AuthProvider (AUTH-01.6
 * final phase — automatic session refresh).
 *
 * The AuthProvider owns all auth state, so the api-client cannot refresh or clear a session
 * on its own. On mount the provider registers two callbacks here; the api-client calls
 * `attemptRefresh()` when a protected request returns 401, and `notifySessionExpired()` when
 * that refresh fails. Keeping the refresh/expiry logic in the provider lets the plain fetch
 * helpers reuse it without duplicating any authentication logic.
 */

/**
 * What a refresh found: a renewed session, a session the server has ended, or no answer about it
 * (a 429, a 5xx, a dropped connection).
 */
export type RefreshOutcome = "renewed" | "expired" | "unavailable";

/**
 * Only a 401 from the refresh route means the session is over. Anything else says nothing about
 * it, so the user keeps the page, and anything typed into it, and the next request tries again.
 */
export function refreshOutcome(status: number | undefined): RefreshOutcome {
  return status === 401 ? "expired" : "unavailable";
}

/** Renews the session and reports what it found. Must not throw. */
type Refresher = () => Promise<RefreshOutcome>;

/** Clears the session and sends the user to /login. */
type ExpiryHandler = () => void;

let refresher: Refresher | null = null;
let onExpired: ExpiryHandler | null = null;
let inFlight: Promise<RefreshOutcome> | null = null;

/** The AuthProvider registers its refresh + expiry handlers (called once, on mount). */
export function registerSessionBridge(
  refresh: Refresher,
  expiry: ExpiryHandler,
): void {
  refresher = refresh;
  onExpired = expiry;
}

/**
 * Single-flight refresh: concurrent 401s share one `/auth/refresh`, preventing a stampede.
 * Resolves to what the refresh found; never rejects. With no bridge registered (before mount /
 * SSR) it fails closed with `"expired"`.
 */
export function attemptRefresh(): Promise<RefreshOutcome> {
  if (!refresher) return Promise.resolve("expired");
  inFlight ??= refresher().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Signals that the session is gone (refresh failed) so the provider clears it and redirects. */
export function notifySessionExpired(): void {
  onExpired?.();
}
