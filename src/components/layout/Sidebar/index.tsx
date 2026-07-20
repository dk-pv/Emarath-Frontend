"use client";

import { usePathname } from "next/navigation";
import { IconLogout } from "@tabler/icons-react";
import { NAV_ITEMS, matchNavItem } from "@/constants/navigation";
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
 * Measured: 230px expanded, 88px collapsed, #363937. The brand block is 101px tall
 * and rows start immediately below it at a fixed 61.2px pitch — verified top-anchored
 * rather than stretched, since row positions are identical at 869px and 842px
 * viewport heights.
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
        className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto scrollbar-none"
      >
        {NAV_ITEMS.map((item) => (
          <SidebarNavLink
            key={item.href}
            label={item.label}
            href={item.href}
            icon={item.href === activeHref ? item.activeIcon : item.icon}
            active={item.href === activeHref}
            collapsed={collapsed}
          />
        ))}
      </nav>

      {/* Sign-out is wired by the Authentication tasks; the shell owns only the row. */}
      <button
        type="button"
        aria-label="Logout"
        className={`${SIDEBAR_ROW_CLASS} ${SIDEBAR_ROW_IDLE} mt-auto mb-logout-offset`}
      >
        <SidebarRowIcon icon={IconLogout} />
        <SidebarRowLabel collapsed={collapsed}>Logout</SidebarRowLabel>
      </button>

      <SidebarToggle collapsed={collapsed} onToggle={onToggle} />
    </aside>
  );
}
