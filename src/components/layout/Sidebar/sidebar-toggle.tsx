import { IconCaretLeftFilled, IconCaretRightFilled } from "@tabler/icons-react";

type SidebarToggleProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * Collapse handle on the sidebar's right edge.
 *
 * Measured 12x202px in brand green, pinned 203px from the sidebar top. It is
 * absolutely positioned rather than centred: its y-position is identical across
 * 869px and 842px viewports and in both sidebar states.
 */
export function SidebarToggle({ collapsed, onToggle }: SidebarToggleProps) {
  const Caret = collapsed ? IconCaretRightFilled : IconCaretLeftFilled;

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={!collapsed}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      className="absolute top-toggle-top right-0 flex h-toggle-h w-toggle-w items-center justify-center rounded-l-full bg-brand focus-ring"
    >
      <Caret size={10} className="text-toggle-glyph" />
    </button>
  );
}
