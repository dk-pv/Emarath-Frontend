"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconSettings, IconUser } from "@tabler/icons-react";
import { ReportToolbarSelect } from "@/components/reports/report-toolbar-select";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { cn } from "@/lib/cn";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import { isPeriodId, type DashboardPeriodId } from "@/lib/dashboard-period";
import { WidgetPeriodFilter } from "./widget-period-filter";

/**
 * The Dashboard's own control row, traced from the supplied Workpex Dashboard captures
 * and measured on ui-reference/dashboard/dashboard-home-default-top.png: a right-aligned
 * row sitting directly under the application header, holding Sales Agent, the applied
 * period chip and Manage Widgets.
 *
 * Every control is real. The agent list is `GET /api/leads/filter-options`, the same
 * source the reports' Sales Agent filter uses; the period is the shared
 * `DASHBOARD_PERIODS` set; Manage Widgets goes to the screen that actually configures
 * the Dashboard's cards. Selections live in the URL, which is where this product keeps
 * filter state, so they survive a reload and a share.
 *
 * **Nothing below this row consumes them yet.** The KPI carousel and the team widgets
 * are still fixtures carrying their own per-widget filters (DASH-01.2), and rebuilding
 * them is a later phase — this row owns the header only.
 */
const CONTROL_CLASS = "h-control-md px-2";

export function DashboardToolbar() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();

  const [options, setOptions] = useState<LeadFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        // Agent options are non-critical: the row still works without them.
      });
    return () => controller.abort();
  }, []);

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      const query = next.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [params, pathname, router],
  );

  const agentKey = params.get("agent") ?? "";
  const agentIds = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const agentOptions = useMemo(
    () =>
      (options?.agents ?? []).map((agent) => ({
        value: agent.id,
        label: agent.name,
      })),
    [options],
  );

  const periodParam = params.get("period");
  const period: DashboardPeriodId = isPeriodId(periodParam)
    ? periodParam
    : "this-month";

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
      <ReportToolbarSelect
        label="Sales Agent"
        icon={IconUser}
        multiple
        searchable
        className={CONTROL_CLASS}
        value={agentIds}
        options={agentOptions}
        onChange={(value) =>
          setParams({ agent: value.length ? value.join(",") : null })
        }
      />

      <WidgetPeriodFilter
        size="lg"
        label="dashboard period"
        value={period}
        clearTo="all"
        onChange={(next) => setParams({ period: next })}
      />

      {/* The Dashboard's cards are configured by Settings → Application Controls →
          Dashboard Settings, so this points at the widget management the product
          actually has rather than opening a panel that does not exist. */}
      <Link
        href="/settings/application-controls/dashboard-settings"
        className={cn(TOOLBAR_BUTTON_CLASS, CONTROL_CLASS)}
      >
        <IconSettings size={18} stroke={1.75} aria-hidden="true" />
        Manage Widgets
      </Link>
    </div>
  );
}
