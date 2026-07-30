"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { AuthSplash } from "@/components/auth/auth-splash";

/**
 * Root entry (AUTH-01.6 Phase 3). The landing target is session-dependent, as FND-02.2
 * anticipated: a signed-in user goes to the Dashboard, everyone else to /login. The splash
 * shows while the initial session check resolves.
 */
export default function Home() {
  const { status } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (status === "authenticated") {
      router.replace("/dashboard");
    } else if (status === "unauthenticated") {
      router.replace("/login");
    }
  }, [status, router]);

  return <AuthSplash />;
}
