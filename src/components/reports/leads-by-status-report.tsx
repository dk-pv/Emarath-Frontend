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
  IconCalendar,
  IconFilter as IconPipeline,
  IconStatusChange,
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
import { StatusDonutChart } from "./status-donut-chart";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { FilterPanel } from "@/components/filters/filter-panel";
import { ManageColumns } from "@/components/table/manage-columns";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  DEFAULT_PERIOD_KEY,
  PERIOD_PRESETS,
  downloadLeadsByStatusExport,
  fetchLeadsByStatusDetailed,
  fetchLeadsByStatusFilterOptions,
  fetchLeadsByStatusSummary,
  periodFrom,
  type LeadsByStatusAgentRef,
  type LeadsByStatusFilters,
  type LeadsByStatusLeadRow,
  type StatusCountRow,
} from "@/services/leads-by-status-report-service";
import type { FilterField, TableColumn } from "@/types";

/** Rows differ by view: per-status counts (summary) or the underlying leads (detailed). */
type Row = StatusCountRow | LeadsByStatusLeadRow;

/** Remembers this report's column arrangement separately from every other module. */
const COLUMN_PREFS_MODULE = "reports:leads-by-status";

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

function AssignedCell({ agents }: { agents: LeadsByStatusAgentRef[] }) {
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
 * as the reference shows: it drills into the Detailed view narrowed to that status, so the
 * rows it opens are exactly the rows it counted.
 */
function summaryColumns(): readonly TableColumn<StatusCountRow>[] {
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
          href={`/leads?status=${encodeURIComponent(row.status)}`}
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

const DETAILED_COLUMNS: readonly TableColumn<LeadsByStatusLeadRow>[] = [
  {
    key: "name",
    header: "Customer Name",
    render: (row) => <CustomerNameLink leadId={row.id} name={row.name} />,
  },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => row.primaryPhone,
  },
  {
    key: "source",
    header: "Source",
    render: (row) => row.source ?? <span className="text-ink-subtle">—</span>,
  },
  {
    key: "status",
    header: "Status",
    render: (row) => <StatusPill status={row.status} color={row.statusColor} />,
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedTo} />,
  },
];

/**
 * Leads By Status report (RPT-02.3). Renders inside the shared ReportShell (RPT-01.2): it owns
 * the toolbar filters and the data, the shell owns the chrome and the loading/empty/error
 * states. Summary view sits the donut + legend beside per-status counts (grouped in the DB);
 * detailed view lists the underlying leads, paginated. Every filter — Sales Agent, Pipeline,
 * Lead Status, By Date and the Filter popover's Source — is a real server query param, so
 * the ring, the counts and the export always describe the same scoped set.
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

  const [teams, setTeams] = useState<string[]>([]);
  const [options, setOptions] = useState<LeadFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadsByStatusFilterOptions(controller.signal)
      .then((result) => setTeams(result.teams))
      .catch(() => {
        // The team list is non-critical: the report still runs without it.
      });
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        // Agent / source options are non-critical for the same reason.
      });
    return () => controller.abort();
  }, []);

  // Pipelines and the status catalogue come from the shared lookups the New Lead form and
  // the board already read.
  const pipelines = useLookup("pipelines");
  const statuses = useLookup("leadStatus");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodKey = params.get("period") ?? DEFAULT_PERIOD_KEY;
  const teamKey = params.get("team") ?? "";
  const agentKey = params.get("agent") ?? "";
  const statusKey = params.get("status") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";
  const sourceKey = params.get("source") ?? "";

  const split = (value: string) =>
    value ? value.split(",").filter(Boolean) : [];
  const teamValues = useMemo(() => split(teamKey), [teamKey]);
  const agentIds = useMemo(() => split(agentKey), [agentKey]);
  const statusValues = useMemo(() => split(statusKey), [statusKey]);
  const sourceValues = useMemo(() => split(sourceKey), [sourceKey]);
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );
  const periodValues = useMemo(
    () => (periodKey === DEFAULT_PERIOD_KEY ? [] : [periodKey]),
    [periodKey],
  );

  const filters: LeadsByStatusFilters = useMemo(
    () => ({
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? null,
      ),
      team: teamValues,
      agent: agentIds,
      status: statusValues,
      pipeline: pipelineKey || undefined,
    }),
    [periodKey, teamValues, agentIds, statusValues, pipelineKey],
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
  const summaryTableColumns = useMemo(() => summaryColumns(), []);

  const { prefs, setPrefs, visibleColumns } = useColumnPrefs(
    COLUMN_PREFS_MODULE,
    DETAILED_COLUMNS,
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
      {
        key: "team",
        label: "Team",
        type: "multi",
        options: teams.map((team) => ({ value: team, label: team })),
      },
    ],
    [options, teams],
  );
  const filterValues: Record<string, string[]> = {
    source: sourceValues,
    team: teamValues,
  };
  const activeFilterCount = Object.values(filterValues).filter(
    (value) => value.length > 0,
  ).length;

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
        portal
        fields={filterFields}
        activeCount={activeFilterCount}
        valueOf={(key) => filterValues[key] ?? []}
        onChange={(key, value) => {
          const next = Array.isArray(value) ? value : [];
          setParams({ [key]: next.length ? next.join(",") : null });
          resetPage();
        }}
        onClear={() => {
          setParams({ source: null, team: null });
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
