"use client";

import { useCallback } from "react";
import {
  IconBusinessplan,
  IconChartLine,
  IconCoin,
  IconFileAnalytics,
  IconFolderExclamation,
  IconTrophy,
  type Icon,
} from "@tabler/icons-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { apiReason } from "@/lib/api-client";
import { formatAED } from "@/lib/format";
import { formatCount, formatRatio } from "@/lib/sales-reports";
import {
  downloadSalesFunnelPdf,
  type SalesFunnelView,
} from "@/services/sales-funnel-report-service";
import { FunnelChart } from "./funnel-chart";
import {
  SalesReportToolbar,
  salesReportSubtitle,
  useSalesAgents,
  useSalesFunnelReport,
  useSalesReportFilters,
  type SalesReportFilters,
} from "./sales-report-controls";
import { SalesReportFrame } from "./sales-report-frame";
import {
  KpiValue,
  SalesKpiCard,
  SalesPanel,
  SalesPanelEmpty,
} from "./sales-report-parts";
import { StageMetricsTable } from "./stage-metrics-table";

const VIEWS = [
  { value: "full", label: "Full Funnel View" },
  { value: "live", label: "Live Funnel View" },
] as const;

/** The section heading each view carries (Oct 2026 captures). */
const HEADINGS: Record<SalesFunnelView, string> = {
  full: "Leads progression across all stages",
  live: "Current stage of each lead",
};

/**
 * Each panel is exactly the room under the pinned heading, as in Workpex — scrolled to the
 * bottom, the panels fill the view — with a floor for very short windows.
 */
const PANEL_HEIGHT = "h-[100cqh] min-h-96";

/**
 * The Leads list narrowed to one stage under the report's filters — what a Live row counted, so
 * its link opens exactly those leads (the Leads by Status report's rule).
 */
function leadsListHref(filters: SalesReportFilters, stage: string): string {
  const conditions: { field: string; operator: string; values: string[] }[] = [
    { field: "status", operator: "is", values: [stage] },
    { field: "pipeline", operator: "is", values: [filters.pipeline] },
  ];
  if (filters.agent)
    conditions.push({
      field: "assignedAgent",
      operator: "is",
      values: [filters.agent],
    });
  if (filters.source)
    conditions.push({
      field: "source",
      operator: "is",
      values: [filters.source],
    });
  const { from, to } = filters.window;
  if (from && to)
    conditions.push({
      field: "createdAt",
      operator: "between",
      values: [from, to],
    });
  return `/leads?conditions=${encodeURIComponent(JSON.stringify(conditions))}`;
}

/**
 * Sales Funnel Report (Oct 2026 captures `analytics-sales-funnel-*-2026-10.png`, July Full and
 * Live). The figures come computed from `GET /reports/sales-funnel` for the board's own filters:
 * Full Funnel View counts each lead in every stage it has been in, Live where it is now. Live's
 * Stage Metrics rows link to their leads and end in a Total row; Full's count a lead once per
 * stage it passed, so they neither add up nor open a list.
 */
export function SalesFunnelReport({ slug }: { slug: string }) {
  const { filters, setParams } = useSalesReportFilters("last30Days");
  const agents = useSalesAgents();
  const view: SalesFunnelView = filters.view === "live" ? "live" : "full";
  const { state, retry, query } = useSalesFunnelReport(filters, view);
  const { toast } = useToast();
  const subtitle = salesReportSubtitle(
    filters,
    agents.find((agent) => agent.id === filters.agent)?.name,
  );

  const exportPdf = useCallback(
    () =>
      downloadSalesFunnelPdf(query, subtitle).catch((error: unknown) =>
        toast({
          title: "Couldn’t export the report",
          description:
            apiReason(error) ?? "Something went wrong. Please try again.",
          tone: "danger",
        }),
      ),
    [query, subtitle, toast],
  );

  const report = state.status === "ready" ? state.report : null;
  const figure = (text: () => string) =>
    state.status === "loading" ? (
      <Skeleton className="h-6 w-24" />
    ) : report === null ? (
      "—"
    ) : (
      text()
    );

  const panelBody = (
    rows: { count: number }[] | undefined,
    content: () => React.ReactNode,
    emptyIcon: Icon,
  ) =>
    state.status === "loading" ? (
      <Loading label="Loading report" className="min-h-72 flex-1" />
    ) : state.status === "error" ? (
      <ErrorState
        className="min-h-72 flex-1"
        title="Couldn’t load the report"
        description="Something went wrong. Please try again."
        onRetry={retry}
      />
    ) : !rows || rows.every((row) => row.count === 0) ? (
      <SalesPanelEmpty icon={emptyIcon} />
    ) : (
      content()
    );

  return (
    <SalesReportFrame
      fill
      slug={slug}
      subtitle={subtitle}
      toolbar={
        <SalesReportToolbar
          filters={filters}
          setParams={setParams}
          agents={agents}
          reportSlug={slug}
          onExportPdf={exportPdf}
        />
      }
      heading={HEADINGS[view]}
      views={
        <SegmentedControl
          variant="pill"
          aria-label="Funnel view"
          options={VIEWS}
          value={view}
          onChange={(next) =>
            setParams({ view: next === "full" ? null : next })
          }
        />
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SalesKpiCard
          title="Total Leads"
          icon={IconBusinessplan}
          accent="blue"
          caption="Active leads in the pipeline"
        >
          <KpiValue>
            {figure(() => formatCount(report?.totals.leads ?? 0))}
          </KpiValue>
        </SalesKpiCard>
        <SalesKpiCard
          title="Total Value"
          icon={IconCoin}
          accent="blue"
          caption="Cumulative leads potential"
        >
          <KpiValue>
            {figure(() => formatAED(report?.totals.totalValue ?? null))}
          </KpiValue>
        </SalesKpiCard>
        <SalesKpiCard
          title="Conversion Rate"
          icon={IconTrophy}
          accent="green"
          caption="Conversion efficiency"
        >
          <KpiValue>
            {figure(() =>
              report?.conversionRate == null
                ? "—"
                : formatRatio(report.conversionRate),
            )}
          </KpiValue>
        </SalesKpiCard>
        <SalesKpiCard
          title="Weighted Forecast"
          icon={IconChartLine}
          accent="amber"
          caption="Probability adjusted pipeline"
        >
          <KpiValue>
            {figure(() => formatAED(report?.totals.weightedValue ?? null))}
          </KpiValue>
        </SalesKpiCard>
      </div>

      <label className="mt-3 inline-flex cursor-pointer items-center gap-2 self-end text-xs text-ink">
        <Checkbox
          className="size-4"
          checked={filters.includeLost}
          onChange={(event) =>
            setParams({ lost: event.target.checked ? null : "0" })
          }
        />
        Include Lost Stage
      </label>

      <div className="mt-3.5 grid items-start gap-3 xl:grid-cols-2">
        <SalesPanel
          className={PANEL_HEIGHT}
          title="Funnel Movement"
          subtitle="Track lead movement and drop-offs across each stage."
        >
          {panelBody(
            report?.funnel,
            () => (
              <div className="scrollbar-slim min-h-0 flex-1 overflow-y-auto">
                <FunnelChart rows={report?.funnel ?? []} />
              </div>
            ),
            IconFileAnalytics,
          )}
        </SalesPanel>
        <SalesPanel
          className={PANEL_HEIGHT}
          title="Stage Metrics"
          subtitle="Key numbers broken down by each pipeline stage."
        >
          {panelBody(
            report?.table,
            () => (
              <StageMetricsTable
                fill
                rows={report?.table ?? []}
                pipeline={filters.pipeline}
                total={view === "live" ? report?.totals : undefined}
                leadsHref={
                  view === "live"
                    ? (stage) => leadsListHref(filters, stage)
                    : undefined
                }
              />
            ),
            IconFolderExclamation,
          )}
        </SalesPanel>
      </div>
    </SalesReportFrame>
  );
}
