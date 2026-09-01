"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { IconFilter as IconPipeline, IconUser } from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import {
  ReportShell,
  type ReportState,
  type ReportViewMode,
} from "./report-shell";
import { BreakdownDonutChart, DONUT_PALETTE } from "./breakdown-donut-chart";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LeadFilterBuilder } from "@/components/leads/lead-filter-builder";
import { leadColumns } from "@/components/leads/lead-columns";
import { ManageColumns } from "@/components/table/manage-columns";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useAdvancedFilter } from "@/hooks/use-advanced-filter";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
  type LeadListItem,
} from "@/services/leads-service";
import {
  isDatePeriodKey,
  periodRange,
  type LeadsByStatusDateField,
} from "@/services/leads-by-status-report-service";
import {
  downloadLostLeadsExport,
  fetchLostLeadsDetailed,
  fetchLostLeadsSummary,
  type LostLeadRow,
  type LostLeadsFilters,
  type LostReasonCountRow,
} from "@/services/lost-leads-report-service";
import type { TableColumn } from "@/types";

/** Rows differ by view: per-reason counts (summary) or the underlying lost leads (detailed). */
type Row = LostReasonCountRow | LostLeadRow;

/** Remembers this report's column arrangement separately from every other module. */
const COLUMN_PREFS_MODULE = "reports:lost-leads";

/** A colour-coded status pill, using the status's real Stage colour (never an invented hue). */
function StatusPill({
  status,
  color,
}: {
  status: string;
  color: string | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
        stageColorClasses(color).badge,
      )}
    >
      {status}
    </span>
  );
}

function AssignedCell({ agents }: { agents: LeadListItem["assignedAgents"] }) {
  if (agents.length === 0) {
    return <span className="text-ink-subtle">Unassigned</span>;
  }
  return (
    <div
      className="flex items-center gap-1"
      title={agents.map((agent) => agent.name).join(", ")}
    >
      {agents.slice(0, 3).map((agent) => (
        <Avatar key={agent.id} name={agent.name} size="sm" />
      ))}
      {agents.length > 3 && (
        <span className="text-xs text-ink-muted">+{agents.length - 3}</span>
      )}
    </div>
  );
}

/** The Leads list's column for a key — the same cell the list renders, fed by the same field. */
function leadColumn(key: string): TableColumn<LostLeadRow> {
  const column = leadColumns.find((candidate) => candidate.key === key);
  if (!column) throw new Error(`The Leads list has no "${key}" column`);
  return column;
}

/** dd-mm-yyyy, as the reference prints its date columns; an absent date dashes. */
function DateCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ink-subtle">—</span>;
  return <span>{formatDate(iso)}</span>;
}

/**
 * The single view's 13 columns in the requested order. All but four are the Leads list's own
 * columns (`leadColumns`) — same cell, same formatting, same field. The report owns Customer
 * Name (a link to the Customer Details page, same tab), Lead Status (LOST pill in its real
 * stage colour), Assigned (its avatar row) and Lost Date (`statusChangedAt` — when the lead
 * became LOST).
 */
const DETAILED_COLUMNS: readonly TableColumn<LostLeadRow>[] = [
  {
    key: "name",
    header: "Customer Name",
    render: (row) => (
      <CustomerNameLink leadId={row.id} name={row.name} from="lost-leads" />
    ),
  },
  leadColumn("firstName"),
  leadColumn("primaryPhone"),
  leadColumn("secondaryPhone"),
  leadColumn("actualAmount"),
  leadColumn("pipeline"),
  {
    key: "status",
    header: "Lead Status",
    render: (row) => <StatusPill status={row.status} color={row.statusColor} />,
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedAgents} />,
  },
  leadColumn("source"),
  leadColumn("category"),
  leadColumn("country"),
  leadColumn("street"),
  {
    key: "lostAt",
    header: "Lost Date",
    render: (row) => <DateCell iso={row.lostAt} />,
  },
  {
    // RPT-02.7 v2: why the lead was lost, captured when it moved to LOST.
    key: "lostReason",
    header: "Lost Reason",
    render: (row) =>
      row.lostReason ?? (
        <span className="text-ink-subtle">No reason recorded</span>
      ),
  },
];

/** The summary's columns: the reason and an underlined count that drills into it. */
function summaryColumns(
  onDrillDown: (value: string) => void,
): readonly TableColumn<LostReasonCountRow>[] {
  return [
    { key: "reason", header: "Lost Reason", render: (row) => row.reason },
    {
      key: "count",
      header: "No. of Leads",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => onDrillDown(row.value)}
          aria-label={`Show the ${row.count} leads lost for ${row.reason}`}
          className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
        >
          {row.count.toLocaleString("en-US")}
        </button>
      ),
    },
  ];
}

/**
 * Lost Leads report (RPT-02.7). Renders inside the shared ReportShell (RPT-01.2) as a single
 * detailed view — no Summary/Detailed toggle, so the shell's view props are omitted. "Lost"
 * is the approved `status = LOST` definition the ownership metrics share. Every filter —
 * Sales Agent, Pipeline, By Date (created or lost date) and the Filter condition builder —
 * is a real server query param, so the table and the export always describe the same set.
 */
export function LostLeadsReport({
  category,
  slug,
}: {
  category: string;
  slug: string;
}) {
  const resolved = findReport(category, slug);
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { query, page, size, setPage, setSize, resetPage } = useListQuery({
    size: 100,
  });

  const [options, setOptions] = useState<LeadFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        // Agent options are non-critical: the report still runs without them.
      });
    return () => controller.abort();
  }, []);

  const advancedFilter = useAdvancedFilter({ onApplied: resetPage });
  const pipelines = useLookup("pipelines");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const reasonKey = params.get("reason") ?? "";
  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const dateField: LeadsByStatusDateField =
    params.get("dateField") === "statusChanged" ? "statusChanged" : "created";
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";

  const agentIds = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );
  const reasonValues = useMemo(
    () => (reasonKey ? reasonKey.split(",").filter(Boolean) : []),
    [reasonKey],
  );

  const filters: LostLeadsFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      dateField,
      agent: agentIds,
      pipeline: pipelineKey || undefined,
      conditions: advancedFilter.appliedConditions,
      reason: reasonValues,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      dateField,
      agentIds,
      pipelineKey,
      advancedFilter.appliedConditions,
      reasonValues,
    ],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchLostLeadsSummary(filters, signal)
        : fetchLostLeadsDetailed(
            listQuery.page,
            listQuery.size,
            filters,
            signal,
          ),
    [view, filters],
  );
  // Fold view + filters into the list key so a view/filter switch marks the previous rows
  // stale instead of handing the other view's row shape to this view's table.
  const listKey = useMemo(
    () => ({ ...query, view, activeFilters: filters }),
    [query, view, filters],
  );
  const { rows, total, isLoading, isError, refetch } = useListData<Row>(
    dataSource,
    listKey,
  );

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

  /** A reason count opens the Detailed view narrowed to that bucket. */
  const drillDown = useCallback(
    (value: string) => {
      setParams({ view: "detailed", reason: value });
      resetPage();
    },
    [setParams, resetPage],
  );
  const summaryTableColumns = useMemo(
    () => summaryColumns(drillDown),
    [drillDown],
  );

  const { prefs, setPrefs, visibleColumns } = useColumnPrefs(
    COLUMN_PREFS_MODULE,
    DETAILED_COLUMNS,
  );

  if (!resolved) notFound();

  const state: ReportState = isLoading
    ? "loading"
    : isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  // The summary endpoint answers with every reason at once, so the footer's rows-per-page
  // pages the rows already in hand — display paging, never a second source of truth.
  const summaryRows = view === "summary" ? (rows as LostReasonCountRow[]) : [];
  const summaryPageCount = Math.max(1, Math.ceil(summaryRows.length / size));
  const summaryPage = Math.min(page, summaryPageCount);
  const summaryVisible = summaryRows.slice(
    (summaryPage - 1) * size,
    summaryPage * size,
  );

  const filterBar = (
    <div className="flex flex-wrap items-center gap-1 empty:hidden">
      <ReportToolbarSelect
        label="Sales Agent"
        icon={IconUser}
        multiple
        searchable
        value={agentIds}
        onChange={(value) => {
          setParams({ agent: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={(options?.agents ?? []).map((agent) => ({
          value: agent.id,
          label: agent.name,
        }))}
      />
      <ReportToolbarSelect
        label="Pipeline"
        icon={IconPipeline}
        value={pipelineValues}
        onChange={(value) => {
          setParams({ pipeline: value[0] ?? null });
          resetPage();
        }}
        options={pipelines.options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
        clearLabel="All pipelines"
      />
      <ReportDateFilter
        value={{
          field: dateField,
          period: periodKey,
          from: customFrom,
          to: customTo,
        }}
        onApply={(next) => {
          setParams({
            period: next.period,
            dateField: next.field === "created" ? null : next.field,
            from: next.period === "custom" ? (next.from ?? null) : null,
            to: next.period === "custom" ? (next.to ?? null) : null,
          });
          resetPage();
        }}
        onClear={() => {
          setParams({ period: null, dateField: null, from: null, to: null });
          resetPage();
        }}
      />
      <LeadFilterBuilder filter={advancedFilter} label="Lost Leads" />
    </div>
  );

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      viewMode={view}
      onViewModeChange={(mode) => {
        setParams({ view: mode === "summary" ? null : mode });
        resetPage();
      }}
      toolbarActions={
        <>
          {filterBar}
          {view === "detailed" && (
            <ManageColumns
              columns={DETAILED_COLUMNS}
              prefs={prefs}
              onChange={setPrefs}
              triggerClassName={TOOLBAR_BUTTON_CLASS}
            />
          )}
        </>
      }
      trailingActions={<ReportMoreMenu reportSlug={slug} />}
      aside={
        view === "summary" && state === "ready" ? (
          <BreakdownDonutChart
            subject="lost leads by reason"
            total={total}
            onSelect={drillDown}
            slices={summaryRows.map((row, index) => {
              const colors = DONUT_PALETTE[index % DONUT_PALETTE.length];
              return {
                id: row.value,
                label: row.reason,
                count: row.count,
                arcClass: colors.arc,
                swatchClass: colors.swatch,
              };
            })}
          />
        ) : undefined
      }
      onExport={() => downloadLostLeadsExport(filters)}
      state={state}
      emptyTitle="No lost leads"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex min-h-0 flex-col">
        <ResponsiveTableContainer label="Lost Leads">
          {view === "summary" ? (
            <Table<LostReasonCountRow>
              columns={summaryTableColumns}
              rows={summaryVisible}
              getRowId={(row) => row.value}
            />
          ) : (
            <Table<LostLeadRow>
              columns={visibleColumns}
              rows={rows as LostLeadRow[]}
              getRowId={(row) => row.id}
            />
          )}
        </ResponsiveTableContainer>

        <div className="border-t border-hairline p-4">
          {view === "detailed" ? (
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / size))}
              total={total}
              pageSize={size}
              onPageChange={setPage}
              onPageSizeChange={setSize}
            />
          ) : (
            <Pagination
              page={summaryPage}
              pageCount={summaryPageCount}
              total={summaryRows.length}
              pageSize={size}
              onPageChange={setPage}
              onPageSizeChange={setSize}
            />
          )}
        </div>
      </div>
    </ReportShell>
  );
}
