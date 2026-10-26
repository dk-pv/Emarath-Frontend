"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  IconChartHistogram,
  IconGenderMale,
  IconLayoutGrid,
  IconLogout,
  IconTrophy,
  IconZoomCheck,
  type Icon,
} from "@tabler/icons-react";
import { homePath } from "@/constants/navigation";
import { useAuth } from "@/components/auth/auth-context";
import { ANALYTICS_CATEGORIES } from "@/components/reports/report-registry";
import { BrandMark } from "../Sidebar/brand-mark";
import { SidebarToggle } from "../Sidebar/sidebar-toggle";
import { SidebarRowLabel } from "../Sidebar/sidebar-row";

/**
 * The reports' own rail, in Workpex's order — which is not the hub's card order. Glyphs are the
 * nearest Tabler drawings; Revenue Report's is a solid dot with an arrow up-right, which is the
 * gender-male circle filled.
 */
const REPORT_ITEMS: readonly { slug: string; icon: Icon; filled?: boolean }[] =
  [
    { slug: "revenue-report", icon: IconGenderMale, filled: true },
    { slug: "sales-funnel", icon: IconChartHistogram },
    { slug: "sales-pipeline-analysis", icon: IconZoomCheck },
    { slug: "user-scorecard", icon: IconTrophy },
  ];

/**
 * Inset, rounded 41px rows on a 45px pitch with 22px glyphs — the report shell's rows, measured
 * from the Oct 2026 Sales Funnel capture; the app sidebar's are full-bleed 56px rows.
 */
const ROW_CLASS =
  "ml-2 mr-3 flex h-10.25 shrink-0 items-center gap-[3px] rounded-[10px] pl-[7px] text-nav font-medium transition-colors duration-(--duration-shell) ease-shell focus-ring-inset";
const ROW_IDLE = "text-white hover:bg-sidebar-hover";

function RowGlyph({ icon: Glyph, filled }: { icon: Icon; filled?: boolean }) {
  return (
    <Glyph
      size={22}
      stroke={1.75}
      fill={filled ? "currentColor" : "none"}
      className="shrink-0"
      aria-hidden="true"
    />
  );
}

/**
 * The Analytics report shell's sidebar (Workpex "Shell B", `analytics-sales-funnel-*` captures):
 * the brand, Home, the four Sales reports with the open one highlighted, and Logout pinned to the
 * bottom. The same dark rail and handle as the app sidebar, but it hides completely (0px) rather
 * than shrinking to an icon rail, and the handle then waits at the content's left edge. Below lg
 * it is the app sidebar's icon rail, so a phone keeps its width for the report.
 */
export function ReportSidebar({
  collapsed,
  onToggle,
}: {
  collapsed: boolean;
  onToggle: () => void;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  const reports = ANALYTICS_CATEGORIES.flatMap((category) => category.reports);
  const rows: { href: string; label: string; icon: Icon; filled?: boolean }[] =
    [
      { href: homePath(user?.role), label: "Home", icon: IconLayoutGrid },
      ...REPORT_ITEMS.flatMap((item) => {
        const report = reports.find((entry) => entry.slug === item.slug);
        return report
          ? [{ ...item, href: report.href, label: report.title }]
          : [];
      }),
    ];

  // The app sidebar's sign-out: the provider revokes the session and clears it locally even if
  // the request fails, then `replace` keeps the report out of Back.
  const handleLogout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await logout();
    } catch {
      // logout() already cleared local state; a failed request must not trap the user.
    } finally {
      router.replace("/login");
    }
  };

  return (
    <div className="relative flex shrink-0">
      <aside
        aria-hidden={collapsed || undefined}
        inert={collapsed}
        className={`flex flex-col overflow-hidden bg-sidebar transition-[width] duration-(--duration-shell) ease-shell ${
          collapsed ? "w-0" : "w-sidebar-collapsed lg:w-sidebar"
        }`}
      >
        <div className="flex h-[90px] shrink-0 items-center justify-center max-lg:justify-start max-lg:pl-brand-inset">
          <BrandMark collapsed={false} />
        </div>

        <nav
          aria-label="Reports"
          className="flex min-h-0 flex-1 flex-col gap-1 overflow-x-hidden overflow-y-auto scrollbar-none pt-4 pb-4"
        >
          {rows.map((row) => {
            const active = pathname === row.href;
            return (
              <Link
                key={row.href}
                href={row.href}
                aria-label={row.label}
                aria-current={active ? "page" : undefined}
                className={`${ROW_CLASS} ${active ? "bg-sidebar-active text-brand" : ROW_IDLE}`}
              >
                <RowGlyph icon={row.icon} filled={row.filled} />
                <SidebarRowLabel collapsed={false}>{row.label}</SidebarRowLabel>
              </Link>
            );
          })}

          <div className="mt-auto pt-4">
            <button
              type="button"
              aria-label="Logout"
              onClick={handleLogout}
              disabled={loggingOut}
              aria-busy={loggingOut}
              className={`${ROW_CLASS} w-[calc(100%-1.25rem)] ${ROW_IDLE} disabled:cursor-not-allowed`}
            >
              <RowGlyph icon={IconLogout} />
              <SidebarRowLabel collapsed={false}>Logout</SidebarRowLabel>
            </button>
          </div>
        </nav>
      </aside>

      <SidebarToggle
        collapsed={collapsed}
        onToggle={onToggle}
        className={
          collapsed
            ? "top-[153px] right-auto left-0 z-10 rounded-l-none rounded-r-full"
            : "top-[153px]"
        }
      />
    </div>
  );
}
