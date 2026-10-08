import type { Metadata } from "next";
import { LoginView } from "@/components/auth/login-view";

export const metadata: Metadata = {
  title: "Log in · Emarath",
};

export default function LoginPage() {
  // The view is `min-h-dvh`, which zoom shrinks to 90 % of the viewport; this grid row is
  // a full viewport tall and stretches it back.
  return (
    <div className="page-zoom grid min-h-[calc(100dvh/var(--page-zoom))]">
      <LoginView />
    </div>
  );
}
