import type { Icon } from "@tabler/icons-react";
import { Tooltip } from "@/components/ui/Tooltip";

/**
 * Shared geometry for every sidebar row — nav links and the logout button alike.
 *
 * Each row is a FIXED 60px (--spacing-nav-item), the height measured from Workpex's active
 * nav row. Workpex uses a constant row height and lets the rail run out with dead space below
 * the last item; it does not stretch rows to fill — so these rows must not flex-grow, or on a
 * tall viewport each balloons past 60px and the sidebar reads bulkier than Workpex. On a short
 * viewport the fixed rows overflow and the nav scrolls. The icon column stays at x=32
 * (--spacing-nav-inset) in *both* sidebar states, which is why collapsing only changes the width
 * and hides the label — the icons never move; --spacing-nav-gap (14px) sets the icon→label gap.
 */
export const SIDEBAR_ROW_CLASS =
  "flex h-nav-item shrink-0 items-center gap-nav-gap pl-nav-inset transition-colors duration-(--duration-shell) ease-shell focus-ring-inset";

/** Hover is not captured in any Workpex screenshot; it reuses the measured active surface. */
export const SIDEBAR_ROW_IDLE = "text-white hover:bg-sidebar-hover";

export function SidebarRowIcon({ icon: IconComponent }: { icon: Icon }) {
  return <IconComponent size={20} stroke={2} className="shrink-0" />;
}

/**
 * Names a row while the rail is collapsed and its label is hidden — the reference
 * shows a black bubble beside the hovered icon.
 *
 * Portalled because both the aside and the nav clip their overflow, which would
 * otherwise cut the bubble off at the rail's edge. `disabled` when expanded, so
 * the visible label is never doubled by a tooltip repeating it. The wrapper takes
 * the row's own width and fixed height, so wrapping a row does not change the
 * nav's layout — the rows stay the same 60px flex items they were.
 */
export function SidebarRowTooltip({
  label,
  collapsed,
  children,
}: {
  label: string;
  collapsed: boolean;
  children: React.ReactElement<{ "aria-describedby"?: string }>;
}) {
  return (
    <Tooltip
      content={label}
      placement="right"
      tone="ink"
      portal
      disabled={!collapsed}
      className="w-full shrink-0"
    >
      {children}
    </Tooltip>
  );
}

export function SidebarRowLabel({
  children,
  collapsed,
}: {
  children: React.ReactNode;
  collapsed: boolean;
}) {
  // Fades rather than toggling `display`, so collapse and expand track the width
  // animation smoothly instead of the label popping in or out. The row already
  // carries an `aria-label`, so the visible text is decorative here — otherwise a
  // still-in-DOM label would give the row two accessible names. The aside clips
  // the overflow, so the faded label never bleeds past the rail mid-animation.
  return (
    <span
      aria-hidden
      className={`text-nav whitespace-nowrap transition-opacity duration-(--duration-shell) ease-shell ${
        collapsed ? "opacity-0" : "opacity-0 lg:opacity-100"
      }`}
    >
      {children}
    </span>
  );
}
