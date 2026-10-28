"use client";

import { useCallback, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
  IconBusinessplan,
  IconChartBar,
  IconChartLine,
  IconCoin,
  IconFilter,
  IconFilterDollar,
  IconFolderExclamation,
  IconTable,
  IconTrophy,
} from "@tabler/icons-react";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { LeadFilterBuilder } from "@/components/leads/lead-filter-builder";
import {
  emptyRow,
  rowsFromPayload,
  type LeadFilterRow,
} from "@/components/leads/lead-filter-config";
import { StagesProvider } from "@/components/stages/stages-context";
import { ManageColumns } from "@/components/table/manage-columns";
import { ErrorState } from "@/components/ui/ErrorState";
import { Loading } from "@/components/ui/Loading";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useAdvancedFilter } from "@/hooks/use-advanced-filter";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { apiReason } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { applyColumnPrefs } from "@/lib/columns";
import { formatAED } from "@/lib/format";
import { formatCount } from "@/lib/sales-reports";
import {
  comparisonLabel,
  formatRate,
  GRANULARITY_TITLE,
  priorWindow,
  revenuePeriodLabel,
  revenueSubtitle,
  targetTitle,
  trendBuckets,
  wholeMonths,
} from "@/lib/revenue-report";
import { periodRange } from "@/services/leads-by-status-report-service";
import { NO_SOURCE_LABEL } from "@/services/leads-by-source-report-service";
import {
  downloadRevenuePdf,
  fetchRevenueDeals,
  fetchRevenueOverview,
  type RevenueGroup,
  type RevenueOverview,
  type RevenueQuery,
  type RevenueSort,
} from "@/services/revenue-report-service";
import type { ColumnPrefs, SortState } from "@/types";
import { ReportMoreMenu } from "../report-more-menu";
import {
  PipelineRevenue,
  RevenueKpiCard,
  RevenueTrendChart,
  SourceTable,
  TargetGaugeCard,
} from "./revenue-charts";
import {
  DEFAULT_GRID_SORT,
  DEFAULT_HIDDEN_GRID_COLUMNS,
  GRID_COLUMNS,
  GroupByControl,
  GROUP_OPTIONS,
  RevenueDataGrid,
  type RevenueGridRow,
} from "./revenue-data-grid";
import {
  ALL_TIME,
  SALES_PERIODS,
  useSalesAgents,
  useSalesReportFilters,
  useServerReport,
  type ReportState,
} from "./sales-report-controls";
import {
  Chip,
  PILL_CLASS,
  SalesAgentFilter,
  SalesDateFilter,
  SalesExportMenu,
  SalesOptionFilter,
  periodLabel,
} from "./sales-report-filters";
import { SalesReportFrame } from "./sales-report-frame";
import { SalesPanel, SalesPanelEmpty } from "./sales-report-parts";

/** Remembers the grid's column arrangement apart from every other table. */
const COLUMN_PREFS_MODULE = "reports:revenue-report";

/** The trend and source panels' height in the capture (427 image px at 125 %). */
const PANEL_HEIGHT = "xl:h-[342px]";

const TABS = [
  { id: "overview", label: "Overview & Trend" },
  { id: "grid", label: "Data Grid", icon: IconTable },
] as const;
type RevenueTab = (typeof TABS)[number]["id"];

function Money({ value }: { value: string | number | null }) {
  return <bdi dir="ltr">{formatAED(value)}</bdi>;
}

const asGroup = (value: string | null): RevenueGroup =>
  GROUP_OPTIONS.find((option) => option.value === value)?.value ?? "none";

/**
 * Overview & Trend and Data Grid (`analytics-revenue-report-*-2026-10.png`): the capture's tab
 * strip, green and underlined when chosen, the Data Grid's table glyph beside its name.
 */
function RevenueTabs({
  value,
  onChange,
  actions,
}: {
  value: RevenueTab;
  onChange: (tab: RevenueTab) => void;
  actions?: React.ReactNode;
}) {
  const select = (index: number, focus: boolean) => {
    const tab = TABS[(index + TABS.length) % TABS.length];
    onChange(tab.id);
    if (focus) document.getElementById(`revenue-tab-${tab.id}`)?.focus();
  };
  return (
    <div className="mt-2 flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-hairline">
      <div role="tablist" aria-label="Revenue Report views" className="flex">
        {TABS.map((tab, index) => {
          const active = tab.id === value;
          const Glyph = "icon" in tab ? tab.icon : null;
          return (
            <button
              key={tab.id}
              id={`revenue-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={active}
              aria-controls={`revenue-panel-${tab.id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => onChange(tab.id)}
              onKeyDown={(event) => {
                if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
                  event.preventDefault();
                  select(index + (event.key === "ArrowRight" ? 1 : -1), true);
                }
              }}
              className={cn(
                "focus-ring -mb-px flex items-center gap-1.5 border-b-2 px-3.5 text-[13px] transition-colors duration-(--duration-shell) ease-shell",
                // The Data Grid's row is taller, for its Group by pills (the grid captures).
                actions ? "h-[42px]" : "h-9",
                active
                  ? "border-brand text-brand"
                  : "border-transparent text-ink-soft hover:text-ink",
              )}
            >
              {Glyph && <Glyph size={15} stroke={1.75} aria-hidden="true" />}
              {tab.label}
            </button>
          );
        })}
      </div>
      {actions && <div className="pb-2.5">{actions}</div>}
    </div>
  );
}

/**
 * The Revenue Report (Analytics, ADR-0099 decision 15), computed on the server
 * (`GET /reports/revenue`, `/deals`, `/export`). A deal is a lead that became WON in the period —
 * the Dashboard's Team Revenue rule — and every figure, the trend, both breakdowns, the Data Grid
 * and the PDF read those same deals under the toolbar's period, Filter, Sales Agent and Pipeline.
 * The browser resolves what only it can in its own timezone: the period's name, the window it is
 * compared with, the whole months that make its target, and the trend's buckets.
 */
export function RevenueReport({ slug }: { slug: string }) {
  const { filters, setParams } = useSalesReportFilters("thisQuarter");
  const params = useSearchParams();
  // Every pipeline until one is picked — the capture's "All pipelines". The shared hook's own
  // `filters.pipeline` falls back to the board's default pipeline, which this report does not.
  const pipeline = params.get("pipeline");
  const group = asGroup(params.get("group"));
  const tab: RevenueTab = filters.view === "grid" ? "grid" : "overview";
  const agents = useSalesAgents();
  const pipelines = useLookup("pipelines");
  const { toast } = useToast();
  const list = useListQuery({ size: 100 });
  const { resetPage } = list;
  const advancedFilter = useAdvancedFilter({ onApplied: resetPage });
  const { prefs: saved, setPrefs } = useColumnPrefs(
    COLUMN_PREFS_MODULE,
    GRID_COLUMNS,
  );
  // Until the user arranges the columns themselves the extras start hidden — in the grid and in
  // Manage Columns alike, so saving one change never turns them on unasked.
  const prefs = useMemo<ColumnPrefs>(
    () =>
      saved.order.length === 0 && saved.hidden.length === 0
        ? { order: [], hidden: DEFAULT_HIDDEN_GRID_COLUMNS }
        : saved,
    [saved],
  );
  const columns = useMemo(() => applyColumnPrefs(GRID_COLUMNS, prefs), [prefs]);

  const { window, period, from, to, agent } = filters;
  const prior = useMemo(
    () => priorWindow(period, { from, to }, periodRange),
    [period, from, to],
  );
  const trend = useMemo(() => trendBuckets(window), [window]);
  const months = wholeMonths(window);
  const query = useMemo<RevenueQuery>(
    () => ({
      from: window.from,
      to: window.to,
      priorFrom: prior?.from,
      priorTo: prior?.to,
      edges: trend?.edges ?? [],
      targetMonths: months,
      agent,
      pipeline,
      conditions: advancedFilter.appliedConditions,
    }),
    [
      window,
      prior,
      trend,
      months,
      agent,
      pipeline,
      advancedFilter.appliedConditions,
    ],
  );
  const { state, retry } = useServerReport(query, fetchRevenueOverview);
  const sort: SortState = list.sort ?? DEFAULT_GRID_SORT;

  const periodText = revenuePeriodLabel(period, window);
  const subtitle = revenueSubtitle(
    periodText,
    agents.find((candidate) => candidate.id === agent)?.name,
    pipeline,
  );

  /** A toolbar change: the URL takes it, and the grid goes back to its first page. */
  const setFilter = useCallback(
    (updates: Record<string, string | null>) => {
      setParams(updates);
      resetPage();
    },
    [setParams, resetPage],
  );

  /** "Click a source to drill down": the Data Grid, narrowed to it on top of any Filter. */
  const drill = (source: string) => {
    const applied: LeadFilterRow[] = rowsFromPayload(
      advancedFilter.appliedConditions,
    ).filter((row) => row.field !== null);
    const condition: Omit<LeadFilterRow, "id"> =
      source === NO_SOURCE_LABEL
        ? { field: "source", operator: "isEmpty", values: [] }
        : { field: "source", operator: "is", values: [source] };
    const already = applied.some(
      (row) =>
        row.field === condition.field &&
        row.operator === condition.operator &&
        row.values.join("\n") === condition.values.join("\n"),
    );
    advancedFilter.applyRows(
      already ? applied : [...applied, { ...emptyRow(), ...condition }],
    );
    setParams({ view: "grid" });
  };

  const exportPdf = () =>
    downloadRevenuePdf(
      query,
      { group, sort: sort.key as RevenueSort, direction: sort.direction },
      { subtitle, labels: trend?.labels ?? [] },
    ).catch((error: unknown) =>
      toast({
        title: "Couldn’t export the report",
        description:
          apiReason(error) ?? "Something went wrong. Please try again.",
        tone: "danger",
      }),
    );

  const toolbar = (
    <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
      <SalesDateFilter
        value={{ period, from, to }}
        periods={SALES_PERIODS}
        onApply={(next) =>
          setFilter({
            period: next.period ?? ALL_TIME,
            from: next.period === "custom" ? (next.from ?? null) : null,
            to: next.period === "custom" ? (next.to ?? null) : null,
          })
        }
        onClear={() => setFilter({ period: ALL_TIME, from: null, to: null })}
      />
      <LeadFilterBuilder
        filter={advancedFilter}
        label="Revenue Report"
        renderTrigger={({ open, count }) => (
          <Chip
            icon={IconFilter}
            label={count > 0 ? `Filter/${count}` : "Filter"}
            set={count > 0}
            open={open}
            alwaysSplit={count > 0}
          />
        )}
      />
      <SalesAgentFilter
        agents={agents}
        value={agent}
        onChange={(next) => setFilter({ agent: next })}
      />
      <SalesOptionFilter
        label="Pipeline"
        icon={IconFilterDollar}
        clearable
        options={pipelines.options}
        value={pipeline}
        onChange={(next) => setFilter({ pipeline: next })}
      />
      {tab === "grid" && (
        <ManageColumns
          columns={GRID_COLUMNS}
          prefs={prefs}
          onChange={setPrefs}
          triggerClassName={cn(TOOLBAR_BUTTON_CLASS, PILL_CLASS)}
        />
      )}
      <SalesExportMenu onPdf={exportPdf} />
      <ReportMoreMenu reportSlug={slug} variant="analytics" />
    </div>
  );

  return (
    <StagesProvider>
      <SalesReportFrame
        fill
        slug={slug}
        subtitle={subtitle}
        toolbar={
          <>
            {toolbar}
            <RevenueTabs
              value={tab}
              onChange={(next) =>
                setParams({ view: next === "overview" ? null : next })
              }
              actions={
                tab === "grid" ? (
                  <GroupByControl
                    value={group}
                    onChange={(next) => {
                      setParams({ group: next === "none" ? null : next });
                      resetPage();
                    }}
                  />
                ) : undefined
              }
            />
            {tab === "overview" && (
              // Pinned with the tabs, at the capture's spacing rather than the frame's heading row.
              <h2 className="mt-[18px] text-base leading-5 font-medium text-ink">
                Revenue Overview
              </h2>
            )}
          </>
        }
      >
        <div
          role="tabpanel"
          id={`revenue-panel-${tab}`}
          aria-labelledby={`revenue-tab-${tab}`}
          className="flex min-w-0 flex-col"
        >
          {tab === "overview" ? (
            <RevenueOverviewTab
              state={state}
              retry={retry}
              comparison={prior ? comparisonLabel(period) : null}
              months={months}
              trendTitle={
                trend
                  ? `${periodLabel({ period, from, to }, SALES_PERIODS) ?? periodText} — ${GRANULARITY_TITLE[trend.granularity]} Revenue`
                  : null
              }
              trendLabels={trend?.labels ?? []}
              monthly={trend?.granularity === "month"}
              onDrill={drill}
            />
          ) : (
            <RevenueGridTab
              query={query}
              group={group}
              list={list}
              sort={sort}
              columns={columns}
            />
          )}
        </div>
      </SalesReportFrame>
    </StagesProvider>
  );
}

function RevenueOverviewTab({
  state,
  retry,
  comparison,
  months,
  trendTitle,
  trendLabels,
  monthly,
  onDrill,
}: {
  state: ReportState<RevenueOverview>;
  retry: () => void;
  comparison: string | null;
  months: number | null;
  trendTitle: string | null;
  trendLabels: readonly string[];
  monthly: boolean;
  onDrill: (source: string) => void;
}) {
  const report = state.status === "ready" ? state.report : null;
  // No comparison line until there are figures to compare: a dash would read "nothing before".
  const compared = report ? comparison : null;
  const figure = (text: (report: RevenueOverview) => React.ReactNode) =>
    state.status === "loading" ? (
      <Skeleton className="inline-block h-6 w-28 align-middle" />
    ) : report === null ? (
      "—"
    ) : (
      text(report)
    );
  const failed = (
    <ErrorState
      className="min-h-60 flex-1"
      title="Couldn’t load the report"
      description="Something went wrong. Please try again."
      onRetry={retry}
    />
  );
  /** A panel's body in its loading and error states, or its content once the report is in. */
  const panel = (content: (report: RevenueOverview) => React.ReactNode) =>
    state.status === "loading" ? (
      <Loading label="Loading report" className="min-h-60 flex-1" />
    ) : state.status === "error" || report === null ? (
      failed
    ) : (
      content(report)
    );
  const noDeals = (
    <SalesPanelEmpty
      icon={IconFolderExclamation}
      title="No revenue in this period"
      description="No lead became WON in the selected period with these filters."
    />
  );

  return (
    <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <RevenueKpiCard
          title="Total Revenue"
          icon={IconCoin}
          accent="blue"
          value={figure((r) => (
            <Money value={r.current.revenue} />
          ))}
          change={report?.change.revenue ?? null}
          comparison={compared}
        />
        <RevenueKpiCard
          title="Deals Closed"
          icon={IconBusinessplan}
          accent="green"
          value={figure((r) => formatCount(r.current.deals))}
          change={report?.change.deals ?? null}
          comparison={compared}
        />
        <RevenueKpiCard
          title="Avg Deal Value"
          icon={IconChartLine}
          accent="purple"
          value={figure((r) =>
            r.current.avgDealValue === null ? (
              "—"
            ) : (
              <Money value={r.current.avgDealValue} />
            ),
          )}
          change={report?.change.avgDealValue ?? null}
          comparison={compared}
        />
        <RevenueKpiCard
          title="Conversion Rate"
          icon={IconTrophy}
          accent="amber"
          value={figure((r) =>
            r.current.conversionRate === null
              ? "—"
              : formatRate(r.current.conversionRate),
          )}
          change={report?.change.conversionRate ?? null}
          comparison={compared}
        />
        <TargetGaugeCard
          title={targetTitle(months)}
          target={report?.target ?? null}
          revenue={report?.current.revenue ?? null}
          loading={state.status === "loading"}
        />
      </div>

      <div className="mt-3 grid items-stretch gap-3.5 xl:grid-cols-2">
        <SalesPanel
          className={PANEL_HEIGHT}
          title="Revenue Trend"
          subtitle="Track revenue generation against your targets over time."
        >
          {panel((r) => (
            <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-4">
              {trendTitle && (
                <h4 className="text-[13px] font-semibold text-ink-soft">
                  {trendTitle}
                </h4>
              )}
              {r.trend.length === 0 ? (
                <SalesPanelEmpty
                  icon={IconChartBar}
                  title="Pick a period to see the trend"
                  description="The trend charts the period's revenue over time, so it needs a date range."
                />
              ) : r.current.deals === 0 && !(monthly && r.target.monthly) ? (
                noDeals
              ) : (
                <div className="mt-5">
                  <RevenueTrendChart
                    trend={r.trend}
                    labels={trendLabels}
                    monthlyTarget={monthly ? r.target.monthly : null}
                  />
                </div>
              )}
            </div>
          ))}
        </SalesPanel>

        <SalesPanel
          className={PANEL_HEIGHT}
          title="Revenue By Lead Source"
          subtitle="Breakdown of revenue originated from different acquisition channels."
        >
          {panel((r) => (
            <div className="flex min-h-0 flex-1 flex-col px-3 pt-2 pb-3">
              <h4 className="text-[13px] font-semibold text-ink-soft">
                Revenue by lead source
              </h4>
              {r.sources.length === 0 ? (
                noDeals
              ) : (
                <>
                  <div className="scrollbar-slim mt-2.5 max-h-80 min-h-0 flex-1 overflow-auto">
                    <SourceTable rows={r.sources} onDrill={onDrill} />
                  </div>
                  <p className="mt-2 text-[10.5px] text-ink-subtle italic">
                    Attribution model: each lead’s current source · click a
                    source to drill down
                  </p>
                </>
              )}
            </div>
          ))}
        </SalesPanel>
      </div>

      <div className="mt-3 grid items-start gap-3.5 xl:grid-cols-2">
        <SalesPanel
          className="min-h-[234px]"
          title="Revenue By Pipeline"
          subtitle="Detailed breakdown of revenue by pipeline."
        >
          {panel((r) =>
            r.pipelines.length === 0 ? (
              noDeals
            ) : (
              <PipelineRevenue rows={r.pipelines} />
            ),
          )}
        </SalesPanel>
      </div>
    </>
  );
}

function RevenueGridTab({
  query,
  group,
  list,
  sort,
  columns,
}: {
  query: RevenueQuery;
  group: RevenueGroup;
  list: ReturnType<typeof useListQuery>;
  sort: SortState;
  columns: typeof GRID_COLUMNS;
}) {
  const dataSource: ListDataSource<RevenueGridRow> = useCallback(
    async (listQuery, signal) => {
      const order = listQuery.sort ?? DEFAULT_GRID_SORT;
      const page = await fetchRevenueDeals(
        query,
        {
          group,
          sort: order.key as RevenueSort,
          direction: order.direction,
          page: listQuery.page,
          size: listQuery.size,
        },
        signal,
      );
      const headings = new Map(
        page.groups.map((entry) => [
          entry.key,
          {
            key: entry.key,
            label: `${entry.label} (${formatCount(entry.count)})`,
          },
        ]),
      );
      return {
        total: page.total,
        rows: page.rows.map((row, index) => ({
          ...row,
          position: (listQuery.page - 1) * listQuery.size + index + 1,
          heading: row.groupKey ? (headings.get(row.groupKey) ?? null) : null,
        })),
      };
    },
    [query, group],
  );
  const listKey = useMemo(
    () => ({ ...list.query, activeFilters: query, group }),
    [list.query, query, group],
  );
  const { rows, total, isLoading, isFetching, isError, refetch } = useListData(
    dataSource,
    listKey,
    { keepPreviousData: true },
  );

  return (
    <RevenueDataGrid
      columns={columns}
      rows={rows}
      total={total}
      sort={sort}
      onSortChange={list.setSort}
      page={list.page}
      size={list.size}
      onPageChange={list.setPage}
      onSizeChange={list.setSize}
      isLoading={isLoading}
      isFetching={isFetching}
      isError={isError}
      onRetry={refetch}
    />
  );
}
