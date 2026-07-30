"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useRouter } from "next/navigation";
import {
  fetchSession,
  login as loginRequest,
  logout as logoutRequest,
  type AuthUser,
} from "@/services/auth-service";
import { registerSessionBridge } from "@/lib/session";

/**
 * App-wide authentication state (AUTH-01.6 foundation). Holds the signed-in user and
 * restores the session on load by silently refreshing (AUTH-01.3): the access cookie is
 * short-lived, so a page reload starts unauthenticated until `/auth/refresh` mints a fresh
 * one from the long-lived refresh cookie. Tokens live in HttpOnly cookies and are never
 * read here — identity is inferred from whether the refresh succeeds.
 *
 * This is the session core only; the login screen, route protection and header wiring
 * consume it in later phases.
 */
type AuthStatus = "loading" | "authenticated" | "unauthenticated";

type AuthContextValue = {
  /** The signed-in user, or null while loading and when signed out. */
  user: AuthUser | null;
  status: AuthStatus;
  /** Verify credentials and start a session. Rejects with `ApiError` so a form can show why. */
  login: (email: string, password: string) => Promise<void>;
  /** End the session; clears local state even if the network call fails. */
  logout: () => Promise<void>;
  /** Re-check the session from the refresh cookie; resolves true if a session now exists. */
  refreshSession: () => Promise<boolean>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  // Restore the session once on mount. A missing/expired refresh cookie is the normal
  // "not logged in" case (401), not an error to surface.
  useEffect(() => {
    const controller = new AbortController();
    fetchSession(controller.signal)
      .then((current) => {
        setUser(current);
        setStatus("authenticated");
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setUser(null);
        setStatus("unauthenticated");
      });
    return () => controller.abort();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const current = await loginRequest({ email, password });
    setUser(current);
    setStatus("authenticated");
  }, []);

  const logout = useCallback(async () => {
    try {
      await logoutRequest();
    } finally {
      // Clear locally regardless — logout is idempotent and the cookies are cleared.
      setUser(null);
      setStatus("unauthenticated");
    }
  }, []);

  const refreshSession = useCallback(async (): Promise<boolean> => {
    try {
      const current = await fetchSession();
      setUser(current);
      setStatus("authenticated");
      return true;
    } catch {
      setUser(null);
      setStatus("unauthenticated");
      return false;
    }
  }, []);

  // Ends a session the server has already rejected (refresh failed): clear locally and return
  // to /login. No /auth/logout call — the refresh token is already invalid.
  const handleExpired = useCallback(() => {
    setUser(null);
    setStatus("unauthenticated");
    router.replace("/login");
  }, [router]);

  // Hand the api-client a way to refresh/expire the session, so a 401 on any request can
  // recover without duplicating auth logic outside this provider (AUTH-01.6 final phase).
  useEffect(() => {
    registerSessionBridge(refreshSession, handleExpired);
  }, [refreshSession, handleExpired]);

  const value = useMemo<AuthContextValue>(
    () => ({ user, status, login, logout, refreshSession }),
    [user, status, login, logout, refreshSession],
  );

  return <AuthContext value={value}>{children}</AuthContext>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error("useAuth must be used within an AuthProvider.");
  }
  return value;
}
