"use client";

import { usePathname } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";
import { NAV_ITEMS, matchNavItem } from "@/constants/navigation";
import { can } from "@/constants/permissions";
import { useAuth } from "@/components/auth/auth-context";
import { BrandMark } from "./brand-mark";
import { SidebarNavLink } from "./sidebar-nav-link";
import { SidebarToggle } from "./sidebar-toggle";
import {
  SIDEBAR_ROW_CLASS,
  SIDEBAR_ROW_IDLE,
  SidebarRowIcon,
  SidebarRowLabel,
} from "./sidebar-row";

type SidebarProps = {
  collapsed: boolean;
  onToggle: () => void;
};

/**
 * 230px expanded, 88px collapsed, #363937. A 60px brand block, then the nav: a flex column
 * whose 12 rows (11 destinations + Logout) each flex-grow from a 44px minimum, so they share
 * the sidebar height evenly — Logout is the last row of that same list, never bottom-pinned,
 * and the rail fills top-to-bottom the way Workpex does instead of leaving dead space below.
 * On a very short viewport the rows hold their 44px minimum and the nav scrolls.
 *
 * It is a flex sibling of the content column rather than `position: fixed`, so it
 * reserves its own width and can never overlap the content.
 *
 * Below `lg` it stays in the collapsed rail form. That reuses a state Workpex
 * actually has instead of inventing a mobile drawer no screenshot shows.
 */
export function Sidebar({ collapsed, onToggle }: SidebarProps) {
  const pathname = usePathname();
  const activeHref = matchNavItem(pathname)?.href;
  const { user } = useAuth();

  // Role-driven visibility (AUTH-02.2): an item shows unless it declares a capability the
  // caller lacks. No item is gated today, so every role sees the full menu until the
  // Product Owner confirms the role→menu matrix.
  const items = NAV_ITEMS.filter(
    (item) => !item.requires || can(user?.role, item.requires),
  );

  return (
    <aside
      className={`relative flex shrink-0 flex-col overflow-hidden bg-sidebar transition-[width] duration-(--duration-shell) ease-shell ${
        collapsed ? "w-sidebar-collapsed" : "w-sidebar-collapsed lg:w-sidebar"
      }`}
    >
      <div className="flex h-brand-block shrink-0 items-center pl-brand-inset">
        <BrandMark collapsed={collapsed} />
      </div>

      <nav
        aria-label="Main"
        className="flex min-h-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scrollbar-none pb-4"
      >
        {items.map((item) => (
          <SidebarNavLink
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.href === activeHref ? item.activeIcon : item.icon}
            active={item.href === activeHref}
            collapsed={collapsed}
          />
        ))}

        {/* Sign-out is the last row of the same nav flow — an equal flex-grow row directly
            after Settings, sharing the height like every other item, never bottom-pinned.
            Wiring is an Authentication task; the shell owns only the row. */}
        <button
          type="button"
          aria-label="Logout"
          className={`${SIDEBAR_ROW_CLASS} ${SIDEBAR_ROW_IDLE}`}
        >
          <SidebarRowIcon icon={IconLogout} />
          <SidebarRowLabel collapsed={collapsed}>Logout</SidebarRowLabel>
        </button>
      </nav>

      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}
