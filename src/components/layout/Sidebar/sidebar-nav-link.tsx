import Link from "next/link";
import type { Icon } from "@tabler/icons-react";
import {
  SIDEBAR_ROW_CLASS,
  SIDEBAR_ROW_IDLE,
  SidebarRowIcon,
  SidebarRowLabel,
} from "./sidebar-row";

type SidebarNavLinkProps = {
  label: string;
  href: string;
  icon: Icon;
  active: boolean;
  collapsed: boolean;
};

/** The active background is full-bleed across the sidebar — there is no left indicator bar. */
export function SidebarNavLink({
  label,
  href,
  icon,
  active,
  collapsed,
}: SidebarNavLinkProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`${SIDEBAR_ROW_CLASS} ${
        active ? "bg-sidebar-active text-brand" : SIDEBAR_ROW_IDLE
      }`}
    >
      <SidebarRowIcon icon={icon} />
      <SidebarRowLabel collapsed={collapsed}>{label}</SidebarRowLabel>
    </Link>
  );
}
