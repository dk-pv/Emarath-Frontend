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
  IconFilter,
  IconFilters as IconPipeline,
  IconUser,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { followUpColumns } from "./follow-up-columns";
import {
  ReportShell,
  type ReportState,
  type ReportViewMode,
} from "./report-shell";
import { Avatar } from "@/components/ui/Avatar";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { dayBoundaries } from "@/lib/day-boundaries";
import { initialsOf } from "@/lib/format";
import {
  isDatePeriodKey,
  periodRange,
} from "@/services/leads-by-status-report-service";
import {
  FOLLOW_UP_TYPE_LABEL,
  downloadOverdueFollowUpsExport,
  fetchOverdueFollowUpsDetailed,
  fetchOverdueFollowUpsSummary,
  type FollowUpType,
  type OverdueFollowUpsAgentRef,
  type OverdueFollowUpsFilters,
  type OverdueFollowUpRow,
  type OverdueFollowUpsSummaryRow,
} from "@/services/overdue-follow-ups-report-service";
import { fetchAssignableAgents } from "@/services/lookups-service";
import type { TableColumn } from "@/types";

/** Rows differ by view: per-assignee counts (summary) or the overdue follow-ups (detailed). */
type Row = OverdueFollowUpsSummaryRow | OverdueFollowUpRow;

/** The toolbar's Follow Up Type options — the three real `ActivityType` values. */
const TYPE_OPTIONS = (Object.keys(FOLLOW_UP_TYPE_LABEL) as FollowUpType[]).map(
  (value) => ({ value, label: FOLLOW_UP_TYPE_LABEL[value] }),
);

/** The summary's first cell: a muted "Unassigned", or an assignee avatar + name. */
function AssignedUserCell({ row }: { row: OverdueFollowUpsSummaryRow }) {
  if (row.agentId === null) {
    return <span className="text-ink-subtle">{row.agentName}</span>;
  }
  return (
    <span className="flex items-center gap-3">
      <Avatar name={row.agentName} initials={initialsOf(row.agentName)} />
      {row.agentName}
    </span>
  );
}

/** The six columns both Follow Ups reports share; only the origin and the date label differ. */
const DETAILED_COLUMNS = followUpColumns<OverdueFollowUpRow>({
  from: "overdue-follow-ups",
  dateHeader: "Date and Time",
});

/**
 * Overdue Follow Ups report (RPT-03.2). Renders inside the shared ReportShell (RPT-01.2): it owns
 * the toolbar filters and the data, the shell owns the chrome and the loading/empty/error states.
 * "Overdue" reuses the Activities module's own definition (`completedAt IS NULL AND dueAt <
 * todayStart`), so figures reconcile with the Activities Overdue tab.
 *
 * Two views, matching the reference. Summary lists overdue counts per assignee ("Assigned User |
 * Overdue Count", A→Z, grouped and paged on the server) with a defensive "Unassigned" bucket and
 * no Total row; each count links to this report's own detailed view narrowed to that assignee,
 * carrying the active filters, so the number opens the follow-ups it counts. Detailed lists those
 * follow-ups. All data is role-scoped and aggregated on the server; nothing here filters or
 * aggregates rows client-side.
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

  // Assignable agents come from the shared lookup endpoint; pipelines from the lookup cache.
  const [agents, setAgents] = useState<OverdueFollowUpsAgentRef[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then(setAgents)
      .catch(() => {
        // The agent dropdown is non-critical: the report still runs without it.
      });
    return () => controller.abort();
  }, []);
  const pipelines = useLookup("pipelines");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";
  const typeKey = params.get("type") ?? "";

  const agentValues = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const pipelineValues = useMemo(
    () => (pipelineKey ? pipelineKey.split(",").filter(Boolean) : []),
    [pipelineKey],
  );
  const typeValues = useMemo(
    () =>
      typeKey ? (typeKey.split(",").filter(Boolean) as FollowUpType[]) : [],
    [typeKey],
  );

  const filters: OverdueFollowUpsFilters = useMemo(
    () => ({
      todayStart: boundaries.todayStart,
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      agent: agentValues,
      pipeline: pipelineValues,
      type: typeValues,
    }),
    [
      boundaries,
      periodKey,
      customFrom,
      customTo,
      agentValues,
      pipelineValues,
      typeValues,
    ],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchOverdueFollowUpsSummary(
            listQuery.page,
            listQuery.size,
            filters,
            signal,
          )
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

  /**
   * The Activities worklist can express one assignee and at most one follow-up type. It has no
   * concept of this report's By Date window (the follow-up's creation date) or its Pipeline
   * filter, so with either of those applied it would list every one of that agent's overdue
   * follow-ups — more than the number just clicked.
   */
  const worklistCanShowTheCount =
    periodKey === null && pipelineValues.length === 0 && typeValues.length <= 1;

  /**
   * Where an Overdue Count opens. Normally the Activities worklist for that assignee — the
   * module that can actually action the follow-ups (complete, reschedule, the customer panel).
   * When the toolbar carries a filter the worklist cannot represent, it opens this report's own
   * Detailed View narrowed to that assignee instead, which honours every filter. Either way the
   * number opens exactly the rows it counted.
   */
  const countHref = useCallback(
    (agentId: string) => {
      if (!worklistCanShowTheCount) {
        const next = new URLSearchParams(params);
        next.set("view", "detailed");
        next.set("agent", agentId);
        next.delete("page");
        return `${pathname}?${next.toString()}`;
      }
      const next = new URLSearchParams({ bucket: "overdue", agent: agentId });
      if (typeValues.length === 1) next.set("type", typeValues[0]);
      return `/activities?${next.toString()}`;
    },
    [worklistCanShowTheCount, params, pathname, typeValues],
  );

  const summaryColumns: readonly TableColumn<OverdueFollowUpsSummaryRow>[] =
    useMemo(
      () => [
        {
          key: "agent",
          header: "Assigned User",
          render: (row) => <AssignedUserCell row={row} />,
        },
        {
          key: "count",
          header: "Overdue Count",
          align: "right",
          // The count opens that assignee's overdue follow-ups in a new tab. "Unassigned" has no
          // assignee to narrow by, so it stays plain text rather than linking to a wider list.
          render: (row) =>
            row.agentId === null ? (
              <span className="text-ink-subtle">
                {row.count.toLocaleString("en-US")}
              </span>
            ) : (
              <Link
                href={countHref(row.agentId)}
                target="_blank"
                rel="noopener"
                aria-label={`Open ${row.agentName}'s ${row.count} overdue follow-ups in a new tab`}
                className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
              >
                {row.count.toLocaleString("en-US")}
              </Link>
            ),
        },
      ],
      [countHref],
    );

  if (!resolved) notFound();

  const state: ReportState = isLoading
    ? "loading"
    : isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  // The reference right-aligns the whole cluster — filters, Export, the view toggle and the
  // kebab in one row — so the filters ride the shell's right-hand slot rather than its left bar.
  const toolbarActions = (
    <>
      <ReportToolbarSelect
        label="Sales Agent"
        icon={IconUser}
        multiple
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
      <ReportToolbarSelect
        label="Pipeline"
        icon={IconPipeline}
        multiple
        searchable
        value={pipelineValues}
        onChange={(value) => {
          setParams({ pipeline: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={pipelines.options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <ReportToolbarSelect
        label="Follow Up Type"
        icon={IconFilter}
        multiple
        value={typeValues}
        onChange={(value) => {
          setParams({ type: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={TYPE_OPTIONS}
      />
      <ReportDateFilter
        value={{
          field: "created",
          period: periodKey,
          from: customFrom,
          to: customTo,
        }}
        onApply={(next) => {
          setParams({
            period: next.period,
            from: next.period === "custom" ? (next.from ?? null) : null,
            to: next.period === "custom" ? (next.to ?? null) : null,
          });
          resetPage();
        }}
        onClear={() => {
          setParams({ period: null, from: null, to: null });
          resetPage();
        }}
      />
    </>
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
      toolbarActions={toolbarActions}
      trailingActions={<ReportMoreMenu reportSlug={resolved.report.slug} />}
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
              columns={summaryColumns}
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

        <div className="border-t border-hairline p-4">
          {view === "summary" ? (
            // The reference's summary footer carries the rows-per-page control alone; the page
            // nav and the row-count line appear only once the assignees outgrow a single page.
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / size))}
              pageSize={size}
              onPageChange={setPage}
              onPageSizeChange={setSize}
              hideNavWhenSingle
            />
          ) : (
            <Pagination
              page={page}
              pageCount={Math.max(1, Math.ceil(total / size))}
              total={total}
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
