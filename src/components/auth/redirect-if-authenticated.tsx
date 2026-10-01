"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AuthSplash } from "@/components/auth/auth-splash";
import { homePath } from "@/constants/navigation";

/**
 * Keeps signed-in users off the auth pages (AUTH-01.6 Phase 3): an authenticated visitor to
 * /login is redirected to their landing page (the Dashboard), and the form renders only once we know there is no
 * session. The splash covers the initial check so the form never flashes for a logged-in
 * user. Reuses the shared AuthProvider.
 */
export function RedirectIfAuthenticated({
  children,
}: {
  children: React.ReactNode;
}) {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(homePath(user?.role));
    }
  }, [status, user, router]);

  if (status === "unauthenticated") {
    return <>{children}</>;
  }

  return <AuthSplash />;
}
