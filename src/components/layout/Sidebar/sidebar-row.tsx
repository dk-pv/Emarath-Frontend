import type { Icon } from "@tabler/icons-react";

/**
 * Shared geometry for every sidebar row — nav links and the logout button alike.
 *
 * Each row is a flex child of the nav column with a 44px minimum (the comfortable /
 * keyboard-friendly target) and flex-1, so the rows grow equally to share the sidebar
 * height — Workpex's roomy, even vertical rhythm that fills the rail, instead of a compact
 * block with dead space below. On a very short viewport they hold the 44px minimum and the
 * nav scrolls. The icon column stays at x=32 (--spacing-nav-inset) in *both* sidebar states,
 * which is why collapsing only changes the width and hides the label — the icons never move;
 * --spacing-nav-gap (14px) sets the icon→label gap.
 */
export const SIDEBAR_ROW_CLASS =
  "flex min-h-nav-item flex-1 items-center gap-nav-gap pl-nav-inset transition-colors duration-(--duration-shell) ease-shell focus-ring-inset";

/** Hover is not captured in any Workpex screenshot; it reuses the measured active surface. */
export const SIDEBAR_ROW_IDLE = "text-white hover:bg-sidebar-hover";

export function SidebarRowIcon({ icon: IconComponent }: { icon: Icon }) {
  return <IconComponent size={20} stroke={2} className="shrink-0" />;
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
