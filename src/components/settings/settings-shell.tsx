import { Card } from "@/components/ui/Card";
import { SettingsSidebar } from "./settings-sidebar";

/**
 * The two-pane settings frame from the Workpex screenshots: a fixed-width navigation rail
 * on the left, the selected screen on the right in its own card.
 *
 * The rail collapses away below `lg` rather than stacking above the content, because on a
 * phone the roster is what the user came for — the way in is the Settings hub, which is
 * still one tap away. `min-w-0` on the content pane is load-bearing: without it a wide
 * table would size this grid column to its intrinsic width and scroll the whole page
 * sideways instead of scrolling inside the table.
 */
export function SettingsShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 gap-6">
      <Card className="hidden w-72 shrink-0 overflow-hidden p-0 lg:flex lg:flex-col xl:w-80">
        <SettingsSidebar />
      </Card>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
