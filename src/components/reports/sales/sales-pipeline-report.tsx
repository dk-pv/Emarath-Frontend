"use client";

import { useCallback } from "react";
import {
  IconBusinessplan,
  IconCalendarOff,
  IconChartLine,
  IconFileAnalytics,
  IconFolderExclamation,
  IconInfoCircle,
  IconTrophy,
  type Icon,
} from "@tabler/icons-react";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { apiReason } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import {
  COVERAGE_LABELS,
  formatCount,
  formatCoverage,
} from "@/lib/sales-reports";
import {
  downloadSalesPipelinePdf,
  type SalesPipelineView,
} from "@/services/sales-pipeline-report-service";
import {
  CoverageBadge,
  CoverageBar,
  RevenueGauge,
  StageBars,
} from "./pipeline-charts";
import {
  SalesReportToolbar,
  salesReportSubtitle,
  useSalesAgents,
  useSalesPipelineReport,
  useSalesReportFilters,
} from "./sales-report-controls";
import { SalesReportFrame } from "./sales-report-frame";
import {
  KpiPair,
  KpiValue,
  SalesKpiCard,
  SalesPanel,
  SalesPanelEmpty,
} from "./sales-report-parts";
import { StageMetricsTable } from "./stage-metrics-table";

const VIEWS = [
  { value: "health", label: "Pipeline Health" },
  { value: "closing", label: "Closing Leads" },
] as const;

const HEADINGS: Record<SalesPipelineView, string> = {
  health: "Pipeline strength and forecast coverage at a glance",
  closing: "All leads due to close, with their value and stage details",
};

/** Workpex dates these figures by each lead's expected closing date, which Emarath doesn't record. */
const NEEDS_CLOSE_DATE = "Needs expected closing dates";

/** The empty-state panels' height in the Oct 2026 captures (407 image px at 125 %). */
const PANEL_MIN = "min-h-[326px]";

/** The rule behind the 3× figures — Workpex's ⓘ text was never captured, so this is ours. */
const COVERAGE_HELP =
  "Open pipeline value ÷ this month’s revenue target. Critical below 1.5×, Risk to 3×, On track from 3×.";

/**
 * Sales Pipeline Analysis (Oct 2026 captures `analytics-sales-pipeline-*-2026-10.png`), computed
 * on the server (`GET /reports/sales-pipeline`). Each figure keeps its own scope:
 *
 * - Total Open Leads, Weighted Forecast (value × stage probability), Pipeline by Stage and Stage
 *   Metrics: the open sales stages for leads created in the window — the board's own leads;
 * - Won: leads that became WON in the window (the Dashboard's conversion rule);
 * - revenue, target and coverage: this calendar month, by the Dashboard's Team Revenue rules,
 *   coverage being the open pipeline ÷ the target.
 *
 * Workpex dates its closing figures by each lead's expected closing date; Emarath records no
 * such date, so Closing This Month and the Closing Leads panels say so instead of a number.
 */
export function SalesPipelineReport({ slug }: { slug: string }) {
  const { filters, setParams } = useSalesReportFilters("last30Days");
  const agents = useSalesAgents();
  const { state, retry, query } = useSalesPipelineReport(filters);
  const { toast } = useToast();
  const view: SalesPipelineView =
    filters.view === "closing" ? "closing" : "health";
  const subtitle = salesReportSubtitle(
    filters,
    agents.find((agent) => agent.id === filters.agent)?.name,
  );

  const exportPdf = useCallback(
    () =>
      downloadSalesPipelinePdf(query, view, subtitle).catch((error: unknown) =>
        toast({
          title: "Couldn’t export the report",
          description:
            apiReason(error) ?? "Something went wrong. Please try again.",
          tone: "danger",
        }),
      ),
    [query, view, subtitle, toast],
  );

  const report = state.status === "ready" ? state.report : null;
  const figure = (text: () => string) =>
    state.status === "loading" ? (
      <Skeleton className="inline-block h-5 w-16 align-middle" />
    ) : report === null ? (
      "—"
    ) : (
      text()
    );

  const failed = (
    <ErrorState
      className="min-h-72 flex-1"
      title="Couldn’t load the report"
      description="Something went wrong. Please try again."
      onRetry={retry}
    />
  );
  const stagePanel = (content: () => React.ReactNode, emptyIcon: Icon) =>
    state.status === "loading" ? (
      <Loading label="Loading report" className="min-h-72 flex-1" />
    ) : state.status === "error" ? (
      failed
    ) : report === null || report.totals.leads === 0 ? (
      <SalesPanelEmpty icon={emptyIcon} />
    ) : (
      content()
    );

  const closingEmpty = (
    <SalesPanelEmpty
      icon={IconCalendarOff}
      title="Expected closing dates aren’t recorded yet"
      description="This view groups leads by the date they’re expected to close, which Emarath doesn’t capture on a lead yet."
    />
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
          withSource
          reportSlug={slug}
          onExportPdf={exportPdf}
        />
      }
      heading={HEADINGS[view]}
      views={
        <SegmentedControl
          variant="pill"
          aria-label="Pipeline view"
          options={VIEWS}
          value={view}
          onChange={(next) =>
            setParams({ view: next === "health" ? null : next })
          }
        />
      }
    >
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <SalesKpiCard
          title="Total Open Leads"
          icon={IconBusinessplan}
          accent="blue"
          caption="Active pipeline entries"
        >
          <KpiPair
            first={{
              value: figure(() => formatAED(report?.totals.totalValue ?? null)),
              label: "Pipeline Value",
            }}
            second={{
              value: figure(() => formatCount(report?.totals.leads ?? 0)),
              label: "Lead Count",
            }}
          />
        </SalesKpiCard>
        <SalesKpiCard
          title="Weighted Forecast"
          icon={IconChartLine}
          accent="amber"
          caption="Probability-adjusted value"
        >
          <KpiValue>
            {figure(() => formatAED(report?.totals.weightedValue ?? null))}
          </KpiValue>
        </SalesKpiCard>
        <SalesKpiCard
          title="Coverage Ratio (This Month)"
          icon={IconTrophy}
          accent="red"
          caption={
            report === null
              ? "Pipeline ÷ this month’s target"
              : report.coverage.status
                ? COVERAGE_LABELS[report.coverage.status]
                : "No revenue target set"
          }
        >
          <KpiValue>
            {figure(() => formatCoverage(report?.coverage.ratio ?? null))}
          </KpiValue>
        </SalesKpiCard>
        <SalesKpiCard
          title="Closing This Month"
          icon={IconBusinessplan}
          accent="purple"
          caption={NEEDS_CLOSE_DATE}
        >
          <KpiPair
            first={{ value: "—", label: "Revenue Forecast" }}
            second={{ value: "—", label: "Lead Count" }}
          />
        </SalesKpiCard>
        <SalesKpiCard
          title="Won"
          icon={IconTrophy}
          accent="green"
          caption="Won leads in selected period"
        >
          <KpiValue>{figure(() => formatCount(report?.won ?? 0))}</KpiValue>
        </SalesKpiCard>
      </div>

      {view === "health" ? (
        <>
          <section className="mt-8 grid min-h-[341px] rounded-[18px] border border-hairline lg:grid-cols-2">
            <div className="flex min-w-0 flex-col px-4 pt-[17px] pb-5 max-lg:border-b max-lg:border-hairline lg:border-r lg:border-hairline">
              <h3 className="text-[15px] font-medium text-ink">
                Revenue achieved vs Revenue target{" "}
                <span className="text-xs font-normal text-ink-muted">
                  (This Month)
                </span>
              </h3>
              <div className={cn("mt-1 flex flex-col", !report && "min-h-72")}>
                {report ? (
                  <RevenueGauge revenue={report.revenue} />
                ) : state.status === "error" ? (
                  failed
                ) : (
                  <Loading label="Loading revenue" />
                )}
              </div>
            </div>
            <div className="flex min-w-0 flex-col px-4 pt-[17px] pb-5">
              <h3 className="flex items-center gap-1.5 text-[15px] font-medium text-ink">
                <span>
                  Pipeline coverage — 3× rule{" "}
                  <span className="text-xs font-normal text-ink-muted">
                    (This Month)
                  </span>
                </span>
                <Tooltip content={COVERAGE_HELP}>
                  <span
                    tabIndex={0}
                    aria-label={COVERAGE_HELP}
                    className="focus-ring inline-flex rounded-full text-ink-muted"
                  >
                    <IconInfoCircle
                      size={16}
                      stroke={1.75}
                      aria-hidden="true"
                    />
                  </span>
                </Tooltip>
              </h3>
              {report ? (
                <>
                  <p className="mt-1 flex items-center gap-2.5 text-[15px] font-medium text-ink">
                    {formatCoverage(report.coverage.ratio)}
                    <CoverageBadge status={report.coverage.status} />
                    {report.coverage.ratio === null && (
                      <span className="text-xs font-normal text-ink-muted">
                        No revenue target set this month
                      </span>
                    )}
                  </p>
                  <CoverageBar coverage={report.coverage} />
                </>
              ) : state.status === "error" ? (
                failed
              ) : (
                <Loading label="Loading coverage" className="min-h-72" />
              )}
            </div>
          </section>

          <div className="mt-6 grid items-start gap-3 xl:grid-cols-2">
            <SalesPanel
              className={PANEL_MIN}
              title="Pipeline by Stage"
              subtitle="A visual breakdown of your open leads and their value across each pipeline stage"
            >
              {stagePanel(
                () => (
                  <StageBars rows={report?.stages ?? []} />
                ),
                IconFileAnalytics,
              )}
            </SalesPanel>
            <SalesPanel
              className={PANEL_MIN}
              title="Stage Metrics"
              subtitle="Key numbers broken down by each pipeline stage."
            >
              {stagePanel(
                () => (
                  <StageMetricsTable
                    rows={report?.stages ?? []}
                    pipeline={filters.pipeline}
                    total={report?.totals}
                  />
                ),
                IconFolderExclamation,
              )}
            </SalesPanel>
          </div>
        </>
      ) : (
        <div className="mt-8 grid items-start gap-3 xl:grid-cols-2">
          <SalesPanel
            className={PANEL_MIN}
            title="Closing Value by Owner"
            subtitle="Total expected closing value grouped by each sales agent for the selected period"
          >
            {closingEmpty}
          </SalesPanel>
          <SalesPanel
            className={PANEL_MIN}
            title="Leads Closing"
            subtitle="Leads expected to close, grouped by stage and value"
          >
            {closingEmpty}
          </SalesPanel>
        </div>
      )}
    </SalesReportFrame>
  );
}
