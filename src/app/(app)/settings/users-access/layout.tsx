import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * The Users & Access screens share the two-pane settings frame (navigation rail + content).
 * It lives here rather than on `/settings` because the hub itself has no rail — the Workpex
 * reference shows the rail only once a category has been opened.
 */
export default function UsersAccessLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <PageContainer className="min-h-0 flex-1">
      <SettingsShell>{children}</SettingsShell>
    </PageContainer>
  );
}
