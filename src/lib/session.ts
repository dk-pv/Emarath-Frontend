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

/** Renews the session; resolves true when a usable session exists afterwards. Must not throw. */
type Refresher = () => Promise<boolean>;

/** Clears the session and sends the user to /login. */
type ExpiryHandler = () => void;

let refresher: Refresher | null = null;
let onExpired: ExpiryHandler | null = null;
let inFlight: Promise<boolean> | null = null;

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
 * Resolves to whether a session is available afterwards; never rejects. With no bridge
 * registered (before mount / SSR) it fails closed with `false`.
 */
export function attemptRefresh(): Promise<boolean> {
  if (!refresher) return Promise.resolve(false);
  inFlight ??= refresher().finally(() => {
    inFlight = null;
  });
  return inFlight;
}

/** Signals that the session is gone (refresh failed) so the provider clears it and redirects. */
export function notifySessionExpired(): void {
  onExpired?.();
}
