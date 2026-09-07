import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * The Data & Schema Management screens share the two-pane settings frame, exactly as
 * Activity and Reminders and Call Tracking do. `h-full` is load-bearing: it bounds the
 * frame to the main region's height so a long table scrolls inside its own card instead
 * of pushing the footer off the page.
 */
export default function DataSchemaLayout({
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
