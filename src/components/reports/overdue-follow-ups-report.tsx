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
import { Avatar } from "@/components/ui/Avatar";
import { MultiSelect } from "@/components/ui/MultiSelect";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { dayBoundaries } from "@/lib/day-boundaries";
import { fetchAssignableAgents } from "@/services/lookups-service";
import {
  DEFAULT_PERIOD_KEY,
  FOLLOW_UP_TYPE_LABEL,
  PERIOD_PRESETS,
  downloadOverdueFollowUpsExport,
  fetchOverdueFollowUpsDetailed,
  fetchOverdueFollowUpsFilterOptions,
  fetchOverdueFollowUpsSummary,
  periodFrom,
  type OverdueFollowUpsAgentRef,
  type OverdueFollowUpsFilters,
  type OverdueFollowUpRow,
  type OverdueFollowUpsSummaryRow,
} from "@/services/overdue-follow-ups-report-service";
import type { TableColumn } from "@/types";

/** Rows differ by view: per-assignee counts (summary) or the overdue follow-ups (detailed). */
type Row = OverdueFollowUpsSummaryRow | OverdueFollowUpRow;

/** dd-mm-yyyy, h:mm AM/PM — the Activities list's due-date format (FND-04.1 will share it). */
function formatDueDate(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dd}-${mm}-${yyyy}, ${time}`;
}

/** The summary's first cell: a muted "Unassigned", or an assignee avatar + name. */
function AssignedUserCell({ row }: { row: OverdueFollowUpsSummaryRow }) {
  if (row.agentId === null) {
    return <span className="text-ink-subtle">{row.agentName}</span>;
  }
  return (
    <span className="flex items-center gap-2">
      <Avatar name={row.agentName} size="sm" />
      {row.agentName}
    </span>
  );
}

function AssignedCell({ agents }: { agents: OverdueFollowUpsAgentRef[] }) {
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

const SUMMARY_COLUMNS: readonly TableColumn<OverdueFollowUpsSummaryRow>[] = [
  {
    key: "agent",
    header: "Assigned User",
    render: (row) => <AssignedUserCell row={row} />,
  },
  {
    key: "count",
    header: "Overdue Count",
    align: "right",
    render: (row) => row.count.toLocaleString("en-US"),
  },
];

const DETAILED_COLUMNS: readonly TableColumn<OverdueFollowUpRow>[] = [
  {
    key: "customerName",
    header: "Customer Name",
    render: (row) => row.customerName,
  },
  {
    key: "type",
    header: "Follow Up Type",
    render: (row) => FOLLOW_UP_TYPE_LABEL[row.type],
  },
  {
    key: "dueAt",
    header: "Due Date",
    render: (row) => formatDueDate(row.dueAt),
  },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => row.primaryPhone,
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedTo} />,
  },
];

/**
 * Overdue Follow Ups report (RPT-03.2). Renders inside the shared ReportShell (RPT-01.2): it owns
 * the period/agent/team filters and the data, the shell owns the chrome and the
 * loading/empty/error states. "Overdue" reuses the Activities module's own definition
 * (`completedAt IS NULL AND dueAt < todayStart`), so figures reconcile with the Activities Overdue
 * tab. Summary view shows overdue counts per assignee ("Assigned User | Overdue Count", A→Z,
 * grouped on the server) with a defensive "Unassigned" bucket and no Total row (Workpex parity);
 * detailed view lists the underlying overdue follow-ups, paginated. All data (counts, list and
 * export) is role-scoped and aggregated on the server; nothing here filters or aggregates rows
 * client-side.
 */
export function OverdueFollowUpsReport({
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

  // The overdue cutoff, in the user's own timezone — computed once, like the Activities worklist.
  const boundaries = useMemo(() => dayBoundaries(), []);

  const [teams, setTeams] = useState<string[]>([]);
  const [agents, setAgents] = useState<OverdueFollowUpsAgentRef[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchOverdueFollowUpsFilterOptions(controller.signal)
      .then((options) => setTeams(options.teams))
      .catch(() => {
        // The team dropdown is non-critical: the report still runs without it.
      });
    fetchAssignableAgents(controller.signal)
      .then(setAgents)
      .catch(() => {
        // The agent dropdown is non-critical: the report still runs without it.
      });
    return () => controller.abort();
  }, []);

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodKey = params.get("period") ?? DEFAULT_PERIOD_KEY;
  const agentKey = params.get("agent") ?? "";
  const teamKey = params.get("team") ?? "";

  const agentValues = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const teamValues = useMemo(
    () => (teamKey ? teamKey.split(",").filter(Boolean) : []),
    [teamKey],
  );

  const filters: OverdueFollowUpsFilters = useMemo(
    () => ({
      todayStart: boundaries.todayStart,
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? null,
      ),
      agent: agentValues,
      team: teamValues,
    }),
    [boundaries, periodKey, agentValues, teamValues],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchOverdueFollowUpsSummary(filters, signal)
        : fetchOverdueFollowUpsDetailed(
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
        placeholder="Agent"
        searchable
        value={agentValues}
        onChange={(value) => {
          setParams({ agent: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={agents.map((agent) => ({
          value: agent.id,
          label: agent.name,
        }))}
      />
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
      onExport={() => downloadOverdueFollowUpsExport(filters)}
      state={state}
      emptyTitle="No overdue follow-ups"
      emptyDescription="No overdue follow-ups match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex flex-col">
        <ResponsiveTableContainer label="Overdue Follow Ups">
          {view === "summary" ? (
            <Table<OverdueFollowUpsSummaryRow>
              columns={SUMMARY_COLUMNS}
              rows={rows as OverdueFollowUpsSummaryRow[]}
              getRowId={(row) => row.agentId ?? "unassigned"}
            />
          ) : (
            <Table<OverdueFollowUpRow>
              columns={DETAILED_COLUMNS}
              rows={rows as OverdueFollowUpRow[]}
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
