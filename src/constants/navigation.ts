import {
  IconAdjustmentsFilled,
  IconAdjustmentsHorizontal,
  IconFileFilled,
  IconFiles,
  IconFilter,
  IconFilterFilled,
  IconFocus2,
  IconFocusCentered,
  IconLayoutGrid,
  IconLayoutGridFilled,
  IconPhoneCall,
  IconPhoneFilled,
  IconPuzzle,
  IconPuzzleFilled,
  IconReportAnalytics,
  IconRun,
  IconTrendingUp,
  IconUser,
  IconUserFilled,
  type Icon,
} from "@tabler/icons-react";

export type NavItem = {
  /** Sidebar label. */
  label: string;
  /** Navbar title. Differs from `label` only on /map, which Workpex titles "GPS Map". */
  title: string;
  href: string;
  icon: Icon;
  /** Workpex swaps to a solid icon when active — it is not a recolour of the outline. */
  activeIcon: Icon;
};

/**
 * Order, labels and hrefs come from ui-reference/ — the hrefs are read from each
 * screenshot's address bar rather than inferred. Three would be wrong if guessed
 * from the label: Call Dashboard is /calls, GPS/Map is /map, and Kanban Board is
 * nested at /leads/kanban.
 */
export const NAV_ITEMS: readonly NavItem[] = [
  {
    label: "Dashboard",
    title: "Dashboard",
    href: "/dashboard",
    icon: IconLayoutGrid,
    activeIcon: IconLayoutGridFilled,
  },
  {
    label: "Leads",
    title: "Leads",
    href: "/leads",
    icon: IconUser,
    activeIcon: IconUserFilled,
  },
  {
    label: "Kanban Board",
    title: "Kanban Board",
    href: "/leads/kanban",
    icon: IconFilter,
    activeIcon: IconFilterFilled,
  },
  {
    label: "Activities",
    title: "Activities",
    href: "/activities",
    icon: IconRun,
    activeIcon: IconRun,
  },
  {
    label: "Call Dashboard",
    title: "Call Dashboard",
    href: "/calls",
    icon: IconPhoneCall,
    activeIcon: IconPhoneFilled,
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
  },
  {
    label: "Analytics",
    title: "Analytics",
    href: "/analytics",
    icon: IconTrendingUp,
    activeIcon: IconTrendingUp,
  },
  {
    label: "Integrations",
    title: "Integrations",
    href: "/integrations",
    icon: IconPuzzle,
    activeIcon: IconPuzzleFilled,
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
