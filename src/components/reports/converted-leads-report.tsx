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
  downloadConvertedLeadsExport,
  fetchConvertedLeadsDetailed,
  fetchConvertedLeadsSummary,
  periodFrom,
  type ConvertedLeadsAgentRef,
  type ConvertedLeadsFilters,
  type ConvertedLeadRow,
  type ConvertedLeadsSummaryRow,
} from "@/services/converted-leads-report-service";
import type { TableColumn } from "@/types";

/** Rows differ by view: per-assignee counts + amounts (summary) or the converted leads (detailed). */
type Row = ConvertedLeadsSummaryRow | ConvertedLeadRow;

/** Workpex renders amounts as "130.00 د.إ" (reports show an "Actual Amount" column); absent shows a dash. */
const AED = new Intl.NumberFormat("en-AE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
function formatAmount(value: string | null): string {
  if (value === null) return "—";
  const amount = Number(value);
  return Number.isNaN(amount) ? "—" : `${AED.format(amount)} د.إ`;
}

/** The summary's first cell: bold "Total", a muted "Unassigned", or an owner avatar + name. */
function AssignedUserCell({ row }: { row: ConvertedLeadsSummaryRow }) {
  if (row.isTotal) {
    return <span className="font-semibold text-ink">{row.agentName}</span>;
  }
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

function AssignedCell({ agents }: { agents: ConvertedLeadsAgentRef[] }) {
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

const SUMMARY_COLUMNS: readonly TableColumn<ConvertedLeadsSummaryRow>[] = [
  {
    key: "agent",
    header: "Assigned User",
    render: (row) => <AssignedUserCell row={row} />,
  },
  {
    key: "count",
    header: "No. of Leads",
    align: "right",
    render: (row) => (
      <span className={row.isTotal ? "font-semibold text-ink" : undefined}>
        {row.count.toLocaleString("en-US")}
      </span>
    ),
  },
  {
    key: "amount",
    header: "Converted Amount",
    align: "right",
    render: (row) => (
      <span className={row.isTotal ? "font-semibold text-ink" : undefined}>
        {formatAmount(row.amount)}
      </span>
    ),
  },
];

const DETAILED_COLUMNS: readonly TableColumn<ConvertedLeadRow>[] = [
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
    key: "actualAmount",
    header: "Actual Amount",
    align: "right",
    render: (row) => formatAmount(row.actualAmount),
  },
];

/**
 * Converted Leads report (RPT-02.6). Renders inside the shared ReportShell (RPT-01.2): it owns the
 * period/agent/source filters and the data, the shell owns the chrome and the loading/empty/error
 * states. A converted lead is one with `status = WON` (the approved definition, reused from the
 * Leads "Converted Leads" quick filter). Summary view shows converted-lead count + total converted
 * amount per assignee (grouped on the server) with an "Unassigned" bucket and a "Total" row;
 * detailed view lists the underlying converted leads with their Actual Amount, paginated. All data
 * (counts, list, amounts and export) is role-scoped and aggregated on the server; nothing here
 * filters or aggregates rows client-side.
 */
export function ConvertedLeadsReport({
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

  const filters: ConvertedLeadsFilters = useMemo(
    () => ({
      from: periodFrom(
        PERIOD_PRESETS.find((preset) => preset.key === periodKey)?.days ?? null,
      ),
      source: sourceValues,
      agent: agentIds,
    }),
    [periodKey, sourceValues, agentIds],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchConvertedLeadsSummary(filters, signal)
        : fetchConvertedLeadsDetailed(
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
      onExport={() => downloadConvertedLeadsExport(filters)}
      state={state}
      emptyTitle="No converted leads"
      emptyDescription="No converted leads match the selected period, agent and source."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex flex-col">
        <ResponsiveTableContainer label="Converted Leads">
          {view === "summary" ? (
            <Table<ConvertedLeadsSummaryRow>
              columns={SUMMARY_COLUMNS}
              rows={rows as ConvertedLeadsSummaryRow[]}
              getRowId={(row) =>
                row.isTotal ? "__total__" : (row.agentId ?? "unassigned")
              }
            />
          ) : (
            <Table<ConvertedLeadRow>
              columns={DETAILED_COLUMNS}
              rows={rows as ConvertedLeadRow[]}
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
