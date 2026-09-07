import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * The Application Controls screens share the two-pane settings frame every other
 * settings category uses. `h-full` is load-bearing: it bounds the frame to the main
 * region's height so a long panel scrolls inside its own card rather than pushing the
 * Cancel/Save footer off the page.
 */
export default function ApplicationControlsLayout({
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
