import type { Icon } from "@tabler/icons-react";

/**
 * Shared geometry for every sidebar row — nav links and the logout button alike.
 *
 * Measured: 61.2px tall, icon ink 18px starting at x=32, label starting at x=68.
 * The icon column sits at x=32 in *both* sidebar states, which is why collapsing
 * only changes the sidebar width and hides the label — the icons never move.
 *
 * Tabler pads its 24px viewBox, so --spacing-nav-icon (22px) renders ~18px of ink,
 * and --spacing-nav-gap (14px) puts the label back at the measured x=68.
 */
export const SIDEBAR_ROW_CLASS =
  "flex h-nav-item shrink-0 items-center gap-nav-gap pl-nav-inset transition-colors duration-(--duration-shell) ease-shell focus-ring-inset";

/** Hover is not captured in any Workpex screenshot; it reuses the measured active surface. */
export const SIDEBAR_ROW_IDLE = "text-white hover:bg-sidebar-hover";

export function SidebarRowIcon({ icon: IconComponent }: { icon: Icon }) {
  return <IconComponent size={22} stroke={2} className="shrink-0" />;
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
