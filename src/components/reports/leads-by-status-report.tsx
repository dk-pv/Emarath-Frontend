"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { findReport } from "./report-registry";
import {
  ReportShell,
  type ReportState,
  type ReportViewMode,
} from "./report-shell";
import { StatusBreakdownChart } from "./status-breakdown-chart";
import { Avatar } from "@/components/ui/Avatar";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
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
import type { TableColumn } from "@/types";

/** Rows differ by view: per-status counts (summary) or the underlying leads (detailed). */
type Row = StatusCountRow | LeadsByStatusLeadRow;

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
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
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

const SUMMARY_COLUMNS: readonly TableColumn<StatusCountRow>[] = [
  {
    key: "status",
    header: "Status",
    render: (row) => (
      <span className="flex items-center gap-2">
        <span
          className={cn(
            "size-3 shrink-0 rounded-sm",
            stageColorClasses(row.color).swatch,
          )}
          aria-hidden="true"
        />
        {row.status}
      </span>
    ),
  },
  {
    key: "count",
    header: "No. of Leads",
    align: "right",
    render: (row) => row.count.toLocaleString("en-US"),
  },
];

const DETAILED_COLUMNS: readonly TableColumn<LeadsByStatusLeadRow>[] = [
  { key: "name", header: "Customer Name", render: (row) => row.name },
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
 * the period/team filters and the data, the shell owns the chrome and the loading/empty/error
 * states. Summary view shows the breakdown chart + per-status counts (grouped in the DB);
 * detailed view lists the underlying leads, paginated. All data (counts, list and export) is
 * role-scoped on the server; nothing here filters or aggregates rows client-side.
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
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadsByStatusFilterOptions(controller.signal)
      .then((options) => setTeams(options.teams))
      .catch(() => {
        // The team dropdown is non-critical: the report still runs without it.
      });
    return () => controller.abort();
  }, []);

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodKey = params.get("period") ?? DEFAULT_PERIOD_KEY;
  const teamKey = params.get("team") ?? "";

  const teamValues = useMemo(
    () => (teamKey ? teamKey.split(",").filter(Boolean) : []),
    [teamKey],
  );

  const filters: LeadsByStatusFilters = useMemo(
    () => ({
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? null,
      ),
      team: teamValues,
    }),
    [periodKey, teamValues],
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

  if (!resolved) notFound();

  const state: ReportState = isLoading
    ? "loading"
    : isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  const filterBar = (
    <div className="flex flex-wrap items-center gap-2">
      <div className="w-56">
        <Select
          aria-label="Period"
          value={periodKey}
          onChange={(event) => {
            setParams({
              period:
                event.target.value === DEFAULT_PERIOD_KEY
                  ? null
                  : event.target.value,
            });
            resetPage();
          }}
          options={PERIOD_PRESETS.map((preset) => ({
            label: preset.label,
            value: preset.key,
          }))}
        />
      </div>
      <MultiSelect
        className="w-56"
        placeholder="Team"
        searchable
        value={teamValues}
        onChange={(value) => {
          setParams({ team: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={teams.map((team) => ({ value: team, label: team }))}
      />
    </div>
  );

  const summaryRows = view === "summary" ? (rows as StatusCountRow[]) : [];

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
      chart={
        view === "summary" && state === "ready" ? (
          <StatusBreakdownChart rows={summaryRows} />
        ) : undefined
      }
      onExport={() => downloadLeadsByStatusExport(filters)}
      state={state}
      emptyTitle="No leads to show"
      emptyDescription="No leads match the selected period and team."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex flex-col">
        <ResponsiveTableContainer label="Leads By Status">
          {view === "summary" ? (
            <Table<StatusCountRow>
              columns={SUMMARY_COLUMNS}
              rows={summaryRows}
              getRowId={(row) => row.status}
            />
          ) : (
            <Table<LeadsByStatusLeadRow>
              columns={DETAILED_COLUMNS}
              rows={rows as LeadsByStatusLeadRow[]}
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
