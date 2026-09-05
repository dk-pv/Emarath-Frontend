import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * The Call Tracking screens share the two-pane settings frame, exactly as Sales & CRM
 * and Users & Access do. `h-full` is load-bearing: it bounds the frame to the main region's
 * height so a long form scrolls inside its own card instead of pushing the Save bar off
 * the page.
 */
export default function CallTrackingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer className="h-full min-h-0 flex-1">
      <SettingsShell>{children}</SettingsShell>
    </PageContainer>
  );
}
