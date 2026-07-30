import { AppLayout } from "@/components/layout/AppLayout";
import { RequireAuth } from "@/components/auth/require-auth";
import { StagesProvider } from "@/components/stages/stages-context";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // RequireAuth is outermost so the toast/stages providers and the shell only mount once a
  // session exists — the stages provider fetches the canonical catalogue on mount (KAN-05.2)
  // and must not fire before the user is authenticated. Inside the gate: the toast provider
  // wraps the shell so any client view can surface feedback (LEAD-09.2), and the stages
  // provider gives the list badge, board columns and status dropdown one source.
  return (
    <RequireAuth>
      <ToastProvider>
        <StagesProvider>
          <AppLayout>{children}</AppLayout>
        </StagesProvider>
      </ToastProvider>
    </RequireAuth>
  );
}
