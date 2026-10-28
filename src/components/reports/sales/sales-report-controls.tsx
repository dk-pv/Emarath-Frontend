"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { IconFileExport, IconFilterDollar } from "@tabler/icons-react";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { resolvePeriodRange } from "@/lib/dashboard-period";
import { DEFAULT_PIPELINE } from "@/services/leads-board-service";
import {
  periodRange,
  type DatePeriodKey,
} from "@/services/leads-by-status-report-service";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  fetchSalesFunnelReport,
  type SalesFunnelView,
} from "@/services/sales-funnel-report-service";
import {
  fetchSalesPipelineReport,
  type SalesPipelineQuery,
} from "@/services/sales-pipeline-report-service";
import { ReportMoreMenu } from "../report-more-menu";
import {
  PILL_CLASS,
  SalesAgentFilter,
  SalesDateFilter,
  SalesExportMenu,
  SalesOptionFilter,
  periodLabel,
} from "./sales-report-filters";

/**
 * The windows the Sales reports offer, in Workpex's order (the Oct 2026 date menu captures).
 * The window applies to the lead's created date, as every Emarath lead report and the Kanban
 * board do.
 */
export const SALES_PERIODS: readonly { key: DatePeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "last7Days", label: "Last 7 Days" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "last30Days", label: "Last 30 Days" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "thisQuarter", label: "This Quarter" },
  { key: "lastQuarter", label: "Last Quarter" },
  { key: "thisFinancialYear", label: "This Financial Year" },
  { key: "lastFinancialYear", label: "Last Financial Year" },
  { key: "custom", label: "Custom Date" },
];

/** `?period=all` keeps a cleared window cleared; no `period` at all means the default. */
export const ALL_TIME = "all";

export interface SalesReportFilters {
  period: DatePeriodKey | null;
  /** The Custom range's date keys. */
  from?: string;
  to?: string;
  /** The created-date window as instants, `[from, to)`; empty for all time. */
  window: { from?: string; to?: string };
  agent: string | null;
  pipeline: string;
  source: string | null;
  /** The report's view toggle; null leaves the report's default. */
  view: string | null;
  /** The Sales Funnel's "Include Lost Stage" — on unless `?lost=0`. */
  includeLost: boolean;
}

/** The filters a Sales report keeps in its URL, so a reload, a shared link or Back keep them. */
export function useSalesReportFilters(defaultPeriod: DatePeriodKey) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(params);
      for (const [key, value] of Object.entries(updates)) {
        if (value === null || value === "") next.delete(key);
        else next.set(key, value);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  const periodParam = params.get("period");
  const from = params.get("from") ?? undefined;
  const to = params.get("to") ?? undefined;
  const agent = params.get("agent");
  const pipeline = params.get("pipeline") || DEFAULT_PIPELINE;
  const source = params.get("source");
  const view = params.get("view");
  const includeLost = params.get("lost") !== "0";

  const filters = useMemo<SalesReportFilters>(() => {
    const period =
      periodParam === ALL_TIME
        ? null
        : (SALES_PERIODS.find((preset) => preset.key === periodParam)?.key ??
          defaultPeriod);
    return {
      period,
      from,
      to,
      window: period ? periodRange(period, { from, to }) : {},
      agent,
      pipeline,
      source,
      view,
      includeLost,
    };
  }, [
    periodParam,
    defaultPeriod,
    from,
    to,
    agent,
    pipeline,
    source,
    view,
    includeLost,
  ]);

  return { filters, setParams };
}

export type ReportState<R> =
  { status: "loading" } | { status: "error" } | { status: "ready"; report: R };

/**
 * One server report for a query, refetched whenever the query changes. A response is kept with
 * the query it answers, so a slower earlier one never shows under newer filters; `retry` re-runs
 * a failed load.
 */
export function useServerReport<Q, R>(
  query: Q,
  fetch: (query: Q, signal: AbortSignal) => Promise<R>,
) {
  const key = JSON.stringify(query);
  const [loaded, setLoaded] = useState<{
    key: string;
    state: ReportState<R>;
  }>();
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetch(query, controller.signal)
      .then((report) => setLoaded({ key, state: { status: "ready", report } }))
      .catch(() => {
        if (!controller.signal.aborted)
          setLoaded({ key, state: { status: "error" } });
      });
    return () => controller.abort();
  }, [key, query, fetch, attempt]);

  const state: ReportState<R> =
    loaded?.key === key ? loaded.state : { status: "loading" };
  const retry = useCallback(() => {
    setLoaded(undefined);
    setAttempt((value) => value + 1);
  }, []);
  return { state, retry, query };
}

/** The Sales Funnel Report for the filters and view (`GET /reports/sales-funnel`). */
export function useSalesFunnelReport(
  filters: SalesReportFilters,
  view: SalesFunnelView,
) {
  const { pipeline, agent, source, includeLost } = filters;
  const { from, to } = filters.window;
  const query = useMemo(
    () => ({ pipeline, from, to, agent, source, view, includeLost }),
    [pipeline, from, to, agent, source, view, includeLost],
  );
  return useServerReport(query, fetchSalesFunnelReport);
}

/**
 * Sales Pipeline Analysis for the filters (`GET /reports/sales-pipeline`), with this calendar
 * month in the viewer's timezone for the "(This Month)" figures — resolved once, on load.
 */
export function useSalesPipelineReport(filters: SalesReportFilters) {
  const { pipeline, agent, source } = filters;
  const { from, to } = filters.window;
  const [month] = useState(() => resolvePeriodRange("this-month"));
  const query = useMemo<SalesPipelineQuery>(
    () => ({
      pipeline,
      from,
      to,
      agent,
      source,
      monthFrom: month.from ?? "",
      monthTo: month.to ?? "",
    }),
    [pipeline, from, to, agent, source, month],
  );
  return useServerReport(query, fetchSalesPipelineReport);
}

/** "Last 30 Days · All agents · Lead Pipeline" — the header's line under the title. */
export function salesReportSubtitle(
  filters: SalesReportFilters,
  agentName: string | undefined,
): string {
  const period = periodLabel(filters, SALES_PERIODS) ?? "All time";
  return [period, agentName ?? "All agents", filters.pipeline].join(" · ");
}

/** The agents the caller can see, for the Sales Agent pill; empty until (or unless) they load. */
export function useSalesAgents(): LeadFilterOptions["agents"] {
  const [agents, setAgents] = useState<LeadFilterOptions["agents"]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then((options) => setAgents(options.agents))
      .catch(() => {
        // The pill only lists names; the report runs for all agents without them.
      });
    return () => controller.abort();
  }, []);
  return agents;
}

/**
 * The report toolbar: the window, Sales Agent, Lead Pipeline (and Lead Source where the report
 * has it), then Export and the More menu, right-aligned. Export downloads a PDF where the report
 * has a server export (`onExportPdf`); elsewhere it stays disabled, since a file built in the
 * browser would bypass the export audit.
 */
export function SalesReportToolbar({
  filters,
  setParams,
  agents,
  withSource = false,
  reportSlug,
  onExportPdf,
}: {
  filters: SalesReportFilters;
  setParams: (updates: Record<string, string | null>) => void;
  agents: LeadFilterOptions["agents"];
  withSource?: boolean;
  reportSlug: string;
  onExportPdf?: () => Promise<void>;
}) {
  const pipelines = useLookup("pipelines");
  const sources = useLookup("sources");

  return (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      <SalesDateFilter
        value={{ period: filters.period, from: filters.from, to: filters.to }}
        periods={SALES_PERIODS}
        onApply={(next) =>
          setParams({
            period: next.period ?? ALL_TIME,
            from: next.period === "custom" ? (next.from ?? null) : null,
            to: next.period === "custom" ? (next.to ?? null) : null,
          })
        }
        onClear={() => setParams({ period: ALL_TIME, from: null, to: null })}
      />
      <SalesAgentFilter
        agents={agents}
        value={filters.agent}
        onChange={(agent) => setParams({ agent })}
      />
      <SalesOptionFilter
        label="Lead Pipeline"
        icon={IconFilterDollar}
        options={pipelines.options}
        value={filters.pipeline}
        onChange={(pipeline) => {
          if (pipeline) setParams({ pipeline });
        }}
      />
      {withSource && (
        <SalesOptionFilter
          label="Lead Source"
          icon={IconFilterDollar}
          clearable
          options={sources.options}
          value={filters.source}
          onChange={(source) => setParams({ source })}
        />
      )}
      <span aria-hidden="true" className="h-6 w-px bg-hairline" />
      {onExportPdf ? (
        <SalesExportMenu onPdf={onExportPdf} />
      ) : (
        <button
          type="button"
          disabled
          title="Export isn't available for this report yet"
          className={cn(
            TOOLBAR_BUTTON_CLASS,
            PILL_CLASS,
            "disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent",
          )}
        >
          <IconFileExport size={18} stroke={1.75} aria-hidden="true" />
          Export
        </button>
      )}
      <ReportMoreMenu reportSlug={reportSlug} variant="analytics" />
    </div>
  );
}
