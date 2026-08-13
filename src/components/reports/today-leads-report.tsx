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
import type { TableColumn } from "@/types";

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

const DETAILED_COLUMNS: readonly TableColumn<TodayLeadRow>[] = [
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
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedTo} />,
  },
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

  const agentIds = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const sourceValues = useMemo(
    () => (sourceKey ? sourceKey.split(",").filter(Boolean) : []),
    [sourceKey],
  );

  const filters: TodayLeadsFilters = useMemo(
    () => ({
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? 0,
      ),
      source: sourceValues,
      agent: agentIds,
    }),
    [periodKey, sourceValues, agentIds],
  );

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
        placeholder="Sales Agent"
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
      <MultiSelect
        className="w-56"
        placeholder="Source"
        searchable
        value={sourceValues}
        onChange={(value) => {
          setParams({ source: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={(options?.sources ?? []).map((source) => ({
          value: source,
          label: source,
        }))}
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
              columns={DETAILED_COLUMNS}
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
