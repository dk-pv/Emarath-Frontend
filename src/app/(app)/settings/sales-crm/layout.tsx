import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * The Sales & CRM screens share the two-pane settings frame (navigation rail + content),
 * exactly as Users & Access does. It lives per-category rather than on `/settings` because
 * the hub itself has no rail — the Workpex reference shows the rail only once a category
 * has been opened.
 *
 * `h-full` is load-bearing: the shell's `<main>` is a block container, so the `flex-1`
 * below it has no flex parent to resolve against and the frame would size to its content.
 * Bounding it to the main region's height is what lets the `min-h-0 flex-1` chain shrink,
 * so a long form scrolls inside its own card instead of pushing the Save bar off the page.
 */
export default function SalesCrmLayout({
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
