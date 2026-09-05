import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsShell } from "@/components/settings/settings-shell";

/**
 * The Users & Access screens share the two-pane settings frame (navigation rail + content).
 * It lives here rather than on `/settings` because the hub itself has no rail — the Workpex
 * reference shows the rail only once a category has been opened.
 *
 * `h-full` is load-bearing: the shell's `<main>` is a block container, so the `flex-1` below
 * it has no flex parent to resolve against and the frame would size to its content. Bounding
 * it to the main region's height (itself viewport-height minus the navbar) is what lets the
 * `min-h-0 flex-1` chain shrink, so a tall tree scrolls inside its own pane instead of
 * pushing the card — and its footer — past the bottom of the page.
 */
export default function UsersAccessLayout({
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
