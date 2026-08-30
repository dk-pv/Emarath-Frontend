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
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  DEFAULT_PERIOD_KEY,
  PERIOD_PRESETS,
  downloadTodayLeadsExport,
  fetchTodayLeadsDetailed,
  fetchTodayLeadsSummary,
  periodFrom,
  type TodayLeadsAgentRef,
  type TodayLeadsFilters,
  type TodayLeadRow,
  type TodayLeadsSummaryRow,
} from "@/services/today-leads-report-service";
import type { FilterField, TableColumn } from "@/types";

/** Rows differ by view: recently-contacted leads (detailed) or per-agent counts (summary). */
type Row = TodayLeadRow | TodayLeadsSummaryRow;

/** dd Mon yyyy, or a muted "Not contacted" when the lead has no call. */
function LastContacted({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ink-subtle">Not contacted</span>;
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

function AssignedCell({ agents }: { agents: TodayLeadsAgentRef[] }) {
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

/** Remembers this report's column arrangement separately from every other module. */
const COLUMN_PREFS_MODULE = "reports:today-leads";

/** Muted em dash for an empty cell, so a blank never reads as a layout gap. */
function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">—</span>;
}

/** dd-mm-yyyy, matching the reference's date columns. */
function DateCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ink-subtle">—</span>;
  return <span>{formatDate(iso)}</span>;
}

/**
 * The Lead Status pill, tinted from the Stage catalogue the server resolved — the same
 * colour source the board and the Leads list read, so a status never looks different here.
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

/**
 * The detailed view's columns, in the order the report specifies. The engagement counters
 * and Last Contacted stay available through Manage Columns rather than being dropped —
 * they are this report's own signal — but start hidden so the visible set is exactly the
 * twelve specified.
 */
const DETAILED_COLUMNS: readonly TableColumn<TodayLeadRow>[] = [
  {
    key: "name",
    header: "Customer Name",
    render: (row) => (
      <CustomerNameLink leadId={row.id} name={row.name} from="today-leads" />
    ),
  },
  {
    key: "assignedDate",
    header: "Assigned Date",
    render: (row) => <DateCell iso={row.assignedDate} />,
  },
  {
    key: "createdAt",
    header: "Created Date",
    render: (row) => <DateCell iso={row.createdAt} />,
  },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => row.primaryPhone,
  },
  {
    key: "firstName",
    header: "First Name",
    render: (row) => orDash(row.firstName),
  },
  {
    key: "secondaryPhone",
    header: "Secondary Phone",
    render: (row) => orDash(row.secondaryPhone),
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedTo} />,
  },
  {
    key: "status",
    header: "Lead Status",
    render: (row) => (
      <StatusBadge status={row.status} color={row.statusColor} />
    ),
  },
  {
    key: "language",
    header: "Language",
    render: (row) => orDash(row.language),
  },
  { key: "source", header: "Source", render: (row) => orDash(row.source) },
  {
    key: "callStatus",
    header: "Call Status",
    render: (row) => orDash(row.callStatus),
  },
  { key: "country", header: "Country", render: (row) => orDash(row.country) },
  {
    key: "callAttempts",
    header: "Call Attempts",
    align: "right",
    render: (row) => row.callAttempts.toLocaleString("en-US"),
  },
  {
    key: "whatsappAttempts",
    header: "WhatsApp Attempts",
    align: "right",
    render: (row) => row.whatsappAttempts.toLocaleString("en-US"),
  },
  {
    key: "lastContactedAt",
    header: "Last Contacted",
    render: (row) => <LastContacted iso={row.lastContactedAt} />,
  },
];

/** Hidden until the user turns them on, so the default table is exactly the twelve. */
const DEFAULT_HIDDEN_COLUMNS = [
  "callAttempts",
  "whatsappAttempts",
  "lastContactedAt",
];

const SUMMARY_COLUMNS: readonly TableColumn<TodayLeadsSummaryRow>[] = [
  { key: "agentName", header: "Assigned User", render: (row) => row.agentName },
  {
    key: "count",
    header: "No. of Leads",
    align: "right",
    render: (row) => row.count.toLocaleString("en-US"),
  },
];

/**
 * Today Leads report (RPT-02.2). Renders inside the shared ReportShell (RPT-01.2): it owns the
 * period/agent/source filters and the data, the shell owns the chrome and the loading/empty/
 * error states. "Recently contacted" is definition A — a lead with a call within the selected
 * period (default: today); "high engagement" is the lead's existing call/WhatsApp attempt
 * counters, shown as columns and used to order most-engaged first (no invented score). All data
 * (list, summary and export) is role-scoped on the server; nothing here filters rows client-side.
 */
export function TodayLeadsReport({
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

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodKey = params.get("period") ?? DEFAULT_PERIOD_KEY;
  const agentKey = params.get("agent") ?? "";
  const sourceKey = params.get("source") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";

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
  const contactedValues = useMemo(
    () => (periodKey === DEFAULT_PERIOD_KEY ? [] : [periodKey]),
    [periodKey],
  );

  const filters: TodayLeadsFilters = useMemo(
    () => ({
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? 0,
      ),
      source: sourceValues,
      agent: agentIds,
      pipeline: pipelineKey || undefined,
    }),
    [periodKey, sourceValues, agentIds, pipelineKey],
  );

  /** Pipelines come from the shared lookup the New Lead form and the board already use. */
  const pipelines = useLookup("pipelines");

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchTodayLeadsSummary(filters, signal)
        : fetchTodayLeadsDetailed(
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
  // Seed the default arrangement once, so the extra signal columns start hidden without
  // preventing the user from turning them on and keeping them on.
  const detailedColumns = useMemo(
    () =>
      prefs.order.length === 0 && prefs.hidden.length === 0
        ? visibleColumns.filter(
            (column) => !DEFAULT_HIDDEN_COLUMNS.includes(column.key),
          )
        : visibleColumns,
    [prefs, visibleColumns],
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
      {/* The contact window: this report's period, named as the reference names it. */}
      <ReportToolbarSelect
        label="Contacted"
        icon={IconCalendar}
        value={contactedValues}
        onChange={(value) => {
          setParams({ period: value[0] ?? null });
          resetPage();
        }}
        options={PERIOD_PRESETS.filter(
          (preset) => preset.key !== DEFAULT_PERIOD_KEY,
        ).map((preset) => ({ value: preset.key, label: preset.label }))}
        clearLabel={
          PERIOD_PRESETS.find((preset) => preset.key === DEFAULT_PERIOD_KEY)
            ?.label ?? "Today"
        }
      />
      <FilterPanel
        portal
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
      onExport={() => downloadTodayLeadsExport(filters)}
      state={state}
      emptyTitle="No matching leads"
      emptyDescription="No leads were contacted in the selected period for this agent and source."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex flex-col">
        <ResponsiveTableContainer label="Today Leads">
          {view === "summary" ? (
            <Table<TodayLeadsSummaryRow>
              columns={SUMMARY_COLUMNS}
              rows={rows as TodayLeadsSummaryRow[]}
              getRowId={(row) => row.agentId ?? "unassigned"}
            />
          ) : (
            <Table<TodayLeadRow>
              columns={detailedColumns}
              rows={rows as TodayLeadRow[]}
              getRowId={(row) => row.id}
            />
          )}
        </ResponsiveTableContainer>

        {view === "detailed" && (
          <div className="border-t border-hairline p-4">
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / size))}
              total={total}
              pageSize={size}
              onPageChange={setPage}
              onPageSizeChange={setSize}
            />
          </div>
        )}
      </div>
    </ReportShell>
  );
}
