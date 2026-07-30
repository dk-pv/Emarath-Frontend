"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AuthSplash } from "@/components/auth/auth-splash";

/**
 * Route guard for the `(app)` group (AUTH-01.6 Phase 3). Renders the shell only when a
 * session exists: while the initial check runs it shows the splash (so the shell never
 * flashes), and an unauthenticated visitor is redirected to /login. Reuses the shared
 * AuthProvider — no auth logic is duplicated here.
 */
export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  if (status !== "authenticated") {
    return <AuthSplash />;
  }

  return <>{children}</>;
}
