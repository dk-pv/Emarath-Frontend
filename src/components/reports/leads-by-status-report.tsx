"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  IconFilter as IconPipeline,
  IconStatusChange,
  IconUser,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import {
  ReportShell,
  type ReportState,
  type ReportViewMode,
} from "./report-shell";
import { StatusDonutChart } from "./status-donut-chart";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { LeadFilterBuilder } from "@/components/leads/lead-filter-builder";
import { ManageColumns } from "@/components/table/manage-columns";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { leadColumns } from "@/components/leads/lead-columns";
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
  downloadLeadsByStatusExport,
  fetchLeadsByStatusDetailed,
  fetchLeadsByStatusSummary,
  isDatePeriodKey,
  periodRange,
  type LeadsByStatusDateField,
  type LeadsByStatusFilters,
  type LeadsByStatusLeadRow,
  type StatusCountRow,
} from "@/services/leads-by-status-report-service";
import type { TableColumn } from "@/types";

/** Rows differ by view: per-status counts (summary) or the underlying leads (detailed). */
type Row = StatusCountRow | LeadsByStatusLeadRow;

/**
 * Remembers this report's column arrangement separately from every other module. Bumped
 * when the detailed view grew from 5 to 29 columns, so a saved v1 arrangement can't
 * reorder or hide the new set.
 */
const COLUMN_PREFS_MODULE = "reports:leads-by-status:v2";

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

/**
 * The summary's columns. The status is its coloured pill and the count an underlined link,
 * as the reference shows: it opens the Leads list narrowed by `leadsHref`, so the rows it
 * opens are exactly the rows it counted.
 */
function summaryColumns(
  leadsHref: (status: string) => string,
): readonly TableColumn<StatusCountRow>[] {
  return [
    {
      key: "status",
      header: "Status",
      render: (row) => <StatusPill status={row.status} color={row.color} />,
    },
    {
      key: "count",
      header: "No. of Leads",
      align: "right",
      // The count opens the full Leads list, already filtered to this status, in a new
      // tab — the reference's behaviour. The legend beside it still drills in-report.
      render: (row) => (
        <Link
          href={leadsHref(row.status)}
          target="_blank"
          rel="noopener"
          aria-label={`Open the ${row.count} leads in ${row.status} in a new tab`}
          className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
        >
          {row.count.toLocaleString("en-US")}
        </Link>
      ),
    },
  ];
}

/** The Leads list's column for a key — the same cell the list renders, fed by the same field. */
function leadColumn(key: string): TableColumn<LeadsByStatusLeadRow> {
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
 * The detailed view's 29 columns in the reference's left-to-right order. All but four are
 * the Leads list's own columns (`leadColumns`) — same cell, same formatting, same field —
 * so a value can never print differently here than on the list. The four the report owns:
 * Customer Name keeps its plain link (not frozen — the reference scrolls it away), Created
 * Date is date-only here, Lead Status is tinted from the server-resolved stage colour, and
 * Assigned is the report's avatar row.
 */
const DETAILED_COLUMNS: readonly TableColumn<LeadsByStatusLeadRow>[] = [
  leadColumn("assignedDate"),
  {
    key: "createdAt",
    header: "Created Date",
    render: (row) => <DateCell iso={row.createdAt} />,
  },
  leadColumn("country"),
  {
    key: "name",
    header: "Customer Name",
    render: (row) => <CustomerNameLink leadId={row.id} name={row.name} />,
  },
  leadColumn("primaryPhone"),
  leadColumn("firstName"),
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedAgents} />,
  },
  {
    key: "status",
    header: "Lead Status",
    render: (row) => <StatusPill status={row.status} color={row.statusColor} />,
  },
  leadColumn("pipeline"),
  leadColumn("secondaryPhone"),
  leadColumn("complaints"),
  leadColumn("language"),
  leadColumn("source"),
  leadColumn("product"),
  leadColumn("productQty"),
  leadColumn("product2"),
  leadColumn("product2Qty"),
  leadColumn("callStatus"),
  leadColumn("callAttempts"),
  leadColumn("whatsappAttempts"),
  leadColumn("state"),
  leadColumn("street"),
  // The reference capitalises this one header.
  { ...leadColumn("city"), header: "CITY" },
  leadColumn("nationalCode"),
  leadColumn("bookingDate"),
  leadColumn("category"),
  leadColumn("actualAmount"),
  leadColumn("forecastedAmount"),
  leadColumn("paymentMethod"),
];

/**
 * Leads By Status report (RPT-02.3). Renders inside the shared ReportShell (RPT-01.2): it owns
 * the toolbar filters and the data, the shell owns the chrome and the loading/empty/error
 * states. Summary view sits the donut + legend beside per-status counts (grouped in the DB);
 * detailed view lists the underlying leads, paginated. Every filter — Sales Agent, Pipeline,
 * Lead Status, By Date and the Filter condition builder's payload — is a real server query
 * param, so the ring, the counts and the export always describe the same scoped set.
 */
export function LeadsByStatusReport({
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

  // The "Filter" popover is the shared Leads condition builder (ADR-0039/0052); its
  // applied `conditions` payload rides every report query beside the toolbar pills.
  const advancedFilter = useAdvancedFilter({ onApplied: resetPage });

  // Pipelines and the status catalogue come from the shared lookups the New Lead form and
  // the board already read.
  const pipelines = useLookup("pipelines");
  const statuses = useLookup("leadStatus");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  // The By Date panel: which preset, which lead date it applies to, and the Custom range.
  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const dateField: LeadsByStatusDateField =
    params.get("dateField") === "statusChanged" ? "statusChanged" : "created";
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const statusKey = params.get("status") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";

  const split = (value: string) =>
    value ? value.split(",").filter(Boolean) : [];
  const agentIds = useMemo(() => split(agentKey), [agentKey]);
  const statusValues = useMemo(() => split(statusKey), [statusKey]);
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );
  const filters: LeadsByStatusFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      dateField,
      agent: agentIds,
      status: statusValues,
      pipeline: pipelineKey || undefined,
      conditions: advancedFilter.appliedConditions,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      dateField,
      agentIds,
      statusValues,
      pipelineKey,
      advancedFilter.appliedConditions,
    ],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchLeadsByStatusSummary(filters, signal)
        : fetchLeadsByStatusDetailed(
            listQuery.page,
            listQuery.size,
            filters,
            signal,
          ),
    [view, filters],
  );

  // `useListData` decides whether its rows are current by `query` identity, but the fetch also
  // depends on the view (summary vs detailed — different row shapes) and the filters, which live
  // outside `query`. Fold them into a fresh key so switching view/filter marks the previous rows
  // stale (loading state) instead of briefly handing the other view's rows to this view's table,
  // which would read fields that shape does not have and crash the report to a blank screen.
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

  /** A status count (or legend row) opens the Detailed view narrowed to that status. */
  const drillDown = useCallback(
    (status: string) => {
      setParams({ view: "detailed", status });
      resetPage();
    },
    [setParams, resetPage],
  );
  /**
   * The Leads list URL for one status count: the status plus every filter the count was
   * computed under, as the list's own advanced-filter payload (ADR-0039) so the list shows
   * exactly the counted rows and its Filter badge says why. A window on the status-change
   * date has no Leads-filter field, so that one filter can't be carried across.
   */
  const leadsHref = useCallback(
    (status: string) => {
      const conditions: {
        field: string;
        operator: string;
        values: string[];
      }[] = [{ field: "status", operator: "is", values: [status] }];
      if (filters.pipeline)
        conditions.push({
          field: "pipeline",
          operator: "is",
          values: [filters.pipeline],
        });
      if (filters.agent?.length)
        conditions.push({
          field: "assignedAgent",
          operator: "is",
          values: filters.agent,
        });
      if (filters.from && filters.to && filters.dateField === "created")
        conditions.push({
          field: "createdAt",
          operator: "between",
          values: [filters.from, filters.to],
        });
      if (filters.conditions) {
        const extra: unknown = JSON.parse(filters.conditions);
        if (Array.isArray(extra)) conditions.push(...extra);
      }
      return `/leads?conditions=${encodeURIComponent(JSON.stringify(conditions))}`;
    },
    [filters],
  );
  const summaryTableColumns = useMemo(
    () => summaryColumns(leadsHref),
    [leadsHref],
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

  // The summary endpoint answers with every status at once, so the footer's rows-per-page
  // pages the rows already in hand — display paging, never a second source of truth.
  const summaryRows = view === "summary" ? (rows as StatusCountRow[]) : [];
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
      <ReportToolbarSelect
        label="Lead Status"
        icon={IconStatusChange}
        multiple
        searchable
        value={statusValues}
        onChange={(value) => {
          setParams({ status: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={statuses.options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
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
      <LeadFilterBuilder filter={advancedFilter} label="Leads By Status" />
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
      // The reference keeps every control in one right-aligned cluster, so the filters
      // ride in `toolbarActions` rather than the left-hand `filterBar` slot.
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
          <StatusDonutChart
            rows={summaryRows}
            total={total}
            onSelectStatus={drillDown}
          />
        ) : undefined
      }
      onExport={() => downloadLeadsByStatusExport(filters)}
      state={state}
      emptyTitle="No leads to show"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex min-h-0 flex-col">
        <ResponsiveTableContainer label="Leads By Status">
          {view === "summary" ? (
            <Table<StatusCountRow>
              columns={summaryTableColumns}
              rows={summaryVisible}
              getRowId={(row) => row.status}
            />
          ) : (
            <Table<LeadsByStatusLeadRow>
              columns={visibleColumns}
              rows={rows as LeadsByStatusLeadRow[]}
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
