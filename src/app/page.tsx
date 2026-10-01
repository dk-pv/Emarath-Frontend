"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AuthSplash } from "@/components/auth/auth-splash";
import { homePath } from "@/constants/navigation";

/**
 * Root entry (AUTH-01.6 Phase 3). The landing target is session-dependent, as FND-02.2
 * anticipated: a signed-in user goes to their landing page (the Dashboard), everyone else to /login. The splash
 * shows while the initial session check resolves.
 */
export default function Home() {
  const { status, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace(homePath(user?.role));
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, user, router]);

  return <AuthSplash />;
}
