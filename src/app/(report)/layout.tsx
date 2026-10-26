import { ReportLayout } from "@/components/layout/ReportLayout";
import { RequireAuth } from "@/components/auth/require-auth";
import { ToastProvider } from "@/components/ui/Toast";

/**
 * The Analytics reports' own shell (Workpex's report view): signed-in only, like `(app)`, but
 * framed by the report sidebar instead of the app sidebar and navbar.
 */
export default function ReportRouteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <ToastProvider>
        <ReportLayout>{children}</ReportLayout>
      </ToastProvider>
    </RequireAuth>
  );
}
