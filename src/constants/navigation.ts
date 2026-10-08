import {
  IconAdjustmentsFilled,
  IconAdjustmentsHorizontal,
  IconFileFilled,
  IconFiles,
  IconFilter,
  IconFilterFilled,
  IconLayoutGrid,
  IconLayoutGridFilled,
  IconPhoneCall,
  IconPhoneFilled,
  IconPuzzle,
  IconPuzzleFilled,
  IconReportAnalytics,
  IconRun,
  IconTrendingUp,
  IconTruck,
  IconTruckFilled,
  IconUser,
  IconUserFilled,
  type Icon,
} from "@tabler/icons-react";
import { can, type Capability } from "@/constants/permissions";
import type { UserRole } from "@/constants/roles";

export type NavItem = {
  /** Sidebar label. */
  label: string;
  /**
   * Navbar title. Differs from `label` where Workpex's page heading is not the sidebar
   * word: /leads/kanban is titled "Kanban" (sidebar "Kanban Board").
   */
  title: string;
  href: string;
  icon: Icon;
  /** Workpex swaps to a solid icon when active — it is not a recolour of the outline. */
  activeIcon: Icon;
  /**
   * Capability required to see this item (AUTH-02.2); absent ⇒ visible to every role.
   * The sales modules are gated away from the post-sale roles (ADR-0084), and Logistics to
   * its order readers (`useLogistics`, which leaves out Accounts); every sales role still sees
   * the full menu.
   */
  requires?: Capability;
};

/**
 * Order, labels and hrefs come from ui-reference/ — the hrefs are read from each
 * screenshot's address bar rather than inferred. Two would be wrong if guessed
 * from the label: Call Dashboard is /calls, and Kanban Board is nested at
 * /leads/kanban.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Dashboard",
    title: "Dashboard",
    href: "/dashboard",
    icon: IconLayoutGrid,
    activeIcon: IconLayoutGridFilled,
    requires: "useSalesModules",
  },
  {
    label: "Leads",
    title: "Leads",
    href: "/leads",
    icon: IconUser,
    activeIcon: IconUserFilled,
    requires: "useSalesModules",
  },
  {
    label: "Kanban Board",
    title: "Kanban",
    href: "/leads/kanban",
    icon: IconFilter,
    activeIcon: IconFilterFilled,
    requires: "useSalesModules",
  },
  {
    label: "Activities",
    title: "Activities",
    href: "/activities",
    icon: IconRun,
    activeIcon: IconRun,
    requires: "useSalesModules",
  },
  {
    label: "Call Dashboard",
    title: "Call Dashboard",
    href: "/calls",
    icon: IconPhoneCall,
    activeIcon: IconPhoneFilled,
    requires: "useSalesModules",
  },
  {
    label: "Documents",
    title: "Documents",
    href: "/documents",
    icon: IconFiles,
    activeIcon: IconFileFilled,
  },
  {
    label: "GPS/Map",
    title: "GPS Map",
    href: "/map",
    icon: IconFocus2,
    activeIcon: IconFocusCentered,
  },
  {
    label: "Reports",
    title: "Reports",
    href: "/reports",
    icon: IconReportAnalytics,
    activeIcon: IconReportAnalytics,
    requires: "useSalesModules",
  },
  {
    label: "Analytics",
    title: "Analytics",
    href: "/analytics",
    icon: IconTrendingUp,
    activeIcon: IconTrendingUp,
    requires: "useSalesModules",
  },
  {
    label: "Integrations",
    title: "Integrations",
    href: "/integrations",
    icon: IconPuzzle,
    activeIcon: IconPuzzleFilled,
    requires: "useSalesModules",
  },
  // The client workflow's order queue (ADR-0085). No Workpex screen exists for it, so it sits
  // after the Workpex items, leaving their order exactly as the reference shows it.
  {
    label: "Logistics",
    title: "Logistics",
    href: "/logistics",
    icon: IconTruck,
    activeIcon: IconTruckFilled,
    requires: "useLogistics",
  },
  {
    label: "Settings",
    title: "Settings",
    href: "/settings",
    icon: IconAdjustmentsHorizontal,
    activeIcon: IconAdjustmentsFilled,
  },
];

/**
 * Where a signed-in user lands: the Dashboard for the sales roles; for a post-sale role, which
 * holds no sales module (ADR-0084), its own queue — Logistics — or, until Accounts has a
 * screen of its own, Documents.
 */
export function homePath(role: UserRole | null | undefined): string {
  if (!role || can(role, "useSalesModules")) return "/dashboard";
  return can(role, "useLogistics") ? "/logistics" : "/documents";
}

/**
 * Longest matching href wins.
 *
 * Workpex highlights only "Kanban Board" on /leads/kanban, never "Leads" as well, so
 * a plain prefix test is wrong. "Reports" stays highlighted across /reports/lead/*,
 * so an exact-equality test is wrong too. Longest-match satisfies both.
 */
export function matchNavItem(pathname: string): NavItem | undefined {
  return NAV_ITEMS.filter(
    (item) => pathname === item.href || pathname.startsWith(`${item.href}/`),
  ).sort((a, b) => b.href.length - a.href.length)[0];
}

/**
 * Navbar titles for routes that are not sidebar destinations. Workpex titles the
 * Import wizard "Import" while still highlighting Leads in the sidebar, so the
 * title cannot come from the matched nav item alone.
 */
const ROUTE_TITLE_OVERRIDES: Record<string, string> = {
  "/leads/import": "Import",
  "/leads/import/history": "Import History",
};

/** The navbar title for a path — an override wins, else the matched nav item. */
export function routeTitle(pathname: string): string {
  return ROUTE_TITLE_OVERRIDES[pathname] ?? matchNavItem(pathname)?.title ?? "";
}
