"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  IconCalendar,
  IconFilter as IconPipeline,
  IconUser,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import {
  ReportShell,
  type ReportState,
  type ReportViewMode,
} from "./report-shell";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { FilterPanel } from "@/components/filters/filter-panel";
import { ManageColumns } from "@/components/table/manage-columns";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  DEFAULT_PERIOD_KEY,
  PERIOD_PRESETS,
  downloadNoActivityExport,
  fetchNoActivityDetailed,
  fetchNoActivitySummary,
  periodFrom,
  type NoActivityAgentRef,
  type NoActivityFilters,
  type NoActivityLeadRow,
  type NoActivitySummaryRow,
} from "@/services/no-activity-report-service";
import type { FilterField, TableColumn } from "@/types";

/** Rows differ by view: affected leads (detailed) or per-agent counts (summary). */
type Row = NoActivityLeadRow | NoActivitySummaryRow;

/** Remembers this report's column arrangement separately from every other module. */
const COLUMN_PREFS_MODULE = "reports:no-activity";

/** Muted em dash for an empty cell, so a blank never reads as a layout gap. */
function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">—</span>;
}

/** dd Mon yyyy, or a muted "No activity" when the lead has never been engaged. */
function LastActivity({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ink-subtle">No activity</span>;
  return (
    <span>
      {new Date(iso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })}
    </span>
  );
}

/**
 * The Lead Status pill, tinted from the Stage catalogue the server resolved — the same
 * colour source the board and the Leads list read, so a status can never look different here.
 */
function StatusBadge({
  status,
  color,
}: {
  status: string;
  color: string | null;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        stageColorClasses(color).badge,
      )}
    >
      {status}
    </span>
  );
}

function AssignedCell({ agents }: { agents: NoActivityAgentRef[] }) {
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
 * The detailed view's columns, in the order the report specifies. "Last Activity" is the
 * report's own signal, so it stays available through Manage Columns rather than being
 * dropped — it is hidden by default so the visible set is exactly the twelve specified.
 */
const DETAILED_COLUMNS: readonly TableColumn<NoActivityLeadRow>[] = [
  {
    key: "name",
    header: "Customer Name",
    render: (row) => <CustomerNameLink leadId={row.id} name={row.name} />,
  },
  {
    key: "firstName",
    header: "First Name",
    render: (row) => orDash(row.firstName),
  },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => row.primaryPhone,
  },
  {
    key: "secondaryPhone",
    header: "Secondary Phone",
    render: (row) => orDash(row.secondaryPhone),
  },
  {
    key: "actualAmount",
    header: "Actual Amount",
    align: "right",
    render: (row) => formatAED(row.actualAmount),
  },
  {
    key: "pipeline",
    header: "Lead Pipeline",
    render: (row) => row.pipeline,
  },
  {
    key: "status",
    header: "Lead Status",
    render: (row) => (
      <StatusBadge status={row.status} color={row.statusColor} />
    ),
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedTo} />,
  },
  { key: "source", header: "Source", render: (row) => orDash(row.source) },
  {
    key: "category",
    header: "Category",
    render: (row) => orDash(row.category),
  },
  { key: "country", header: "Country", render: (row) => orDash(row.country) },
  { key: "street", header: "Street", render: (row) => orDash(row.street) },
  {
    key: "lastActivityAt",
    header: "Last Activity",
    render: (row) => <LastActivity iso={row.lastActivityAt} />,
  },
];

/** Hidden until the user turns it on, so the default table is exactly the twelve columns. */
const DEFAULT_HIDDEN_COLUMNS = ["lastActivityAt"];

/**
 * The summary's columns. The count is an underlined link, as the reference shows: it drills
 * into the Detailed view already filtered to that assignee — so the rows it opens are exactly
 * the rows it counted. The "Unassigned" bucket drills through on the `unassigned` flag, since
 * it has no agent id to filter by.
 */
function summaryColumns(
  onDrillDown: (row: NoActivitySummaryRow) => void,
): readonly TableColumn<NoActivitySummaryRow>[] {
  return [
    {
      key: "agent",
      header: "Assigned User",
      render: (row) => (
        <span className="flex items-center gap-2">
          <Avatar name={row.agentName} size="sm" />
          <span className={row.agentId === null ? "text-ink-muted" : undefined}>
            {row.agentName}
          </span>
        </span>
      ),
    },
    {
      key: "count",
      header: "No. of Leads",
      align: "right",
      render: (row) => (
        <button
          type="button"
          onClick={() => onDrillDown(row)}
          aria-label={`Show the ${row.count} no-activity leads for ${row.agentName}`}
          className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
        >
          {row.count.toLocaleString("en-US")}
        </button>
      ),
    },
  ];
}

/**
 * No Activity Leads report (RPT-02.1). Renders inside the shared ReportShell (RPT-01.2): it
 * owns the toolbar filters and the data, the shell owns the chrome and the
 * loading/empty/error states. "No activity" is definition B — a lead with no completed
 * activity within the selected period (default: never engaged).
 *
 * Summary lists affected-lead counts per assignee; detailed lists the leads themselves with
 * Manage Columns and pagination. Every filter (By Date, Sales Agent, Pipeline, Filter→Source)
 * is a real server query param, so both views, the counts and the export always describe the
 * same scoped set — nothing is filtered or aggregated client-side.
 */
export function NoActivityLeadsReport({
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
        // Filter options are non-critical: the report still lists and exports
        // without them, only the dropdowns are empty.
      });
    return () => controller.abort();
  }, []);

  // Pipelines come from the shared lookup the New Lead form and the board already use.
  const pipelines = useLookup("pipelines");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodKey = params.get("period") ?? DEFAULT_PERIOD_KEY;
  const agentKey = params.get("agent") ?? "";
  const sourceKey = params.get("source") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";
  const unassignedOnly = params.get("unassigned") === "true";

  const agentIds = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const sourceValues = useMemo(
    () => (sourceKey ? sourceKey.split(",").filter(Boolean) : []),
    [sourceKey],
  );
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );
  const periodValues = useMemo(
    () => (periodKey === DEFAULT_PERIOD_KEY ? [] : [periodKey]),
    [periodKey],
  );

  const filters: NoActivityFilters = useMemo(
    () => ({
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? null,
      ),
      source: sourceValues,
      agent: agentIds,
      pipeline: pipelineKey || undefined,
      unassigned: unassignedOnly || undefined,
    }),
    [periodKey, sourceValues, agentIds, pipelineKey, unassignedOnly],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchNoActivitySummary(filters, signal)
        : fetchNoActivityDetailed(
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

  const { prefs, setPrefs, visibleColumns } = useColumnPrefs(
    COLUMN_PREFS_MODULE,
    DETAILED_COLUMNS,
  );
  // Seed the default arrangement once, so "Last Activity" starts hidden without
  // preventing the user from turning it on and keeping it on.
  const detailedColumns = useMemo(
    () =>
      prefs.order.length === 0 && prefs.hidden.length === 0
        ? visibleColumns.filter(
            (column) => !DEFAULT_HIDDEN_COLUMNS.includes(column.key),
          )
        : visibleColumns,
    [prefs, visibleColumns],
  );

  /**
   * A summary count opens the Detailed view narrowed to that row: a named assignee becomes
   * the `agent` filter, the Unassigned bucket the `unassigned` flag. Both are the report's
   * own server filters, so the drilled-in list is the same scoped query that produced the count.
   */
  const drillDown = useCallback(
    (row: NoActivitySummaryRow) => {
      setParams(
        row.agentId === null
          ? { view: "detailed", unassigned: "true", agent: null }
          : { view: "detailed", agent: row.agentId, unassigned: null },
      );
      resetPage();
    },
    [setParams, resetPage],
  );

  const summaryTableColumns = useMemo(
    () => summaryColumns(drillDown),
    [drillDown],
  );

  // The summary endpoint answers with every assignee at once — there is no page to ask
  // the server for — so the footer's rows-per-page pages the rows already in hand. The
  // set is one row per assignee, so this is display paging, never a second source of truth.
  const summaryRows = rows as NoActivitySummaryRow[];
  const summaryPageCount = Math.max(1, Math.ceil(summaryRows.length / size));
  const summaryPage = Math.min(page, summaryPageCount);
  const summaryVisible = summaryRows.slice(
    (summaryPage - 1) * size,
    summaryPage * size,
  );

  /** The "Filter" popover carries the filters that have no dedicated toolbar pill. */
  const filterFields: readonly FilterField[] = useMemo(
    () => [
      {
        key: "source",
        label: "Source",
        type: "multi",
        options: (options?.sources ?? []).map((source) => ({
          value: source,
          label: source,
        })),
      },
    ],
    [options],
  );

  if (!resolved) notFound();

  const state: ReportState = isLoading
    ? "loading"
    : isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  const filterBar = (
    <div className="flex flex-wrap items-center gap-1">
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
        label="By Date"
        icon={IconCalendar}
        value={periodValues}
        onChange={(value) => {
          setParams({ period: value[0] ?? null });
          resetPage();
        }}
        options={PERIOD_PRESETS.filter(
          (preset) => preset.key !== DEFAULT_PERIOD_KEY,
        ).map((preset) => ({ value: preset.key, label: preset.label }))}
        clearLabel={
          PERIOD_PRESETS.find((preset) => preset.key === DEFAULT_PERIOD_KEY)
            ?.label ?? "Any time"
        }
      />
      <FilterPanel
        fields={filterFields}
        activeCount={sourceValues.length > 0 ? 1 : 0}
        valueOf={() => sourceValues}
        onChange={(_key, value) => {
          const next = Array.isArray(value) ? value : [];
          setParams({ source: next.length ? next.join(",") : null });
          resetPage();
        }}
        onClear={() => {
          setParams({ source: null });
          resetPage();
        }}
      />
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
      filterBar={filterBar}
      toolbarActions={
        view === "detailed" ? (
          <ManageColumns
            columns={DETAILED_COLUMNS}
            prefs={prefs}
            onChange={setPrefs}
          />
        ) : null
      }
      trailingActions={<ReportMoreMenu />}
      onExport={() => downloadNoActivityExport(filters)}
      state={state}
      emptyTitle="No matching leads"
      emptyDescription="No leads are missing recent activity for the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex min-h-0 flex-col">
        <ResponsiveTableContainer label="No Activity Leads">
          {view === "summary" ? (
            <Table<NoActivitySummaryRow>
              columns={summaryTableColumns}
              rows={summaryVisible}
              getRowId={(row) => row.agentId ?? "unassigned"}
            />
          ) : (
            <Table<NoActivityLeadRow>
              columns={detailedColumns}
              rows={rows as NoActivityLeadRow[]}
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
