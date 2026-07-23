import { AppLayout } from "@/components/layout/AppLayout";
import { StagesProvider } from "@/components/stages/stages-context";
import { ToastProvider } from "@/components/ui/Toast";

export default function AppRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // The toast provider wraps the app shell so any client view can surface feedback
  // — first used by the bulk actions (LEAD-09.2) to report per-item results. The
  // stages provider fetches the canonical stage catalogue once (KAN-05.2) so the
  // list badge, board columns and status dropdown all read one source.
  return (
    <ToastProvider>
      <StagesProvider>
        <AppLayout>{children}</AppLayout>
      </StagesProvider>
    </ToastProvider>
  );
}
