"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { followUpColumns } from "./follow-up-columns";
import { ReportShell, type ReportState } from "./report-shell";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { dayBoundaries } from "@/lib/day-boundaries";
import { fetchAssignableAgents } from "@/services/lookups-service";
import {
  FOLLOW_UP_TYPE_LABEL,
  type FollowUpType,
  type OverdueFollowUpsAgentRef,
} from "@/services/overdue-follow-ups-report-service";
import {
  downloadTodaysFollowUpsExport,
  fetchTodaysFollowUps,
  type TodaysFollowUpRow,
  type TodaysFollowUpsFilters,
} from "@/services/todays-follow-ups-report-service";

/** The toolbar's Follow Up Type options — the three real `ActivityType` values. */
const TYPE_OPTIONS = (Object.keys(FOLLOW_UP_TYPE_LABEL) as FollowUpType[]).map(
  (value) => ({ value, label: FOLLOW_UP_TYPE_LABEL[value] }),
);

/** The reference's six columns; only the origin and the date label differ from Overdue's. */
const COLUMNS = followUpColumns<TodaysFollowUpRow>({
  from: "todays-follow-ups",
  dateHeader: "Date & Time",
});

/**
 * Today's Follow Ups report (RPT-03.1). Renders inside the shared ReportShell (RPT-01.2): it
 * owns the toolbar filters and the data, the shell owns the chrome and the loading/empty/error
 * states. "Today" reuses the Activities module's own definition (`completedAt IS NULL AND dueAt`
 * inside the client's own day), so the figures reconcile with the Activities Today tab.
 *
 * A single view — the reference shows no Summary/Detailed toggle, so the shell's view props are
 * deliberately omitted and it never renders one. Every filter is a real server query param;
 * nothing here filters or aggregates rows client-side.
 */
export function TodaysFollowUpsReport({
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

  // The day window, in the user's own timezone — computed once, like the Activities worklist.
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

  const filters: TodaysFollowUpsFilters = useMemo(
    () => ({
      todayStart: boundaries.todayStart,
      todayEnd: boundaries.todayEnd,
      agent: agentValues,
      pipeline: pipelineValues,
      type: typeValues,
    }),
    [boundaries, agentValues, pipelineValues, typeValues],
  );

  const dataSource: ListDataSource<TodaysFollowUpRow> = useCallback(
    (listQuery, signal) =>
      fetchTodaysFollowUps(listQuery.page, listQuery.size, filters, signal),
    [filters],
  );

  // The filters live outside `query`, so fold them into the key: changing one marks the previous
  // rows stale (loading state) instead of showing the old day's rows under the new filter.
  const listKey = useMemo(
    () => ({ ...query, activeFilters: filters }),
    [query, filters],
  );
  const { rows, total, isLoading, isError, refetch } =
    useListData<TodaysFollowUpRow>(dataSource, listKey);

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

  // The reference right-aligns the whole cluster — filters, Export and the kebab in one row —
  // so the filters ride the shell's right-hand slot rather than its left bar.
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
    </>
  );

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      toolbarActions={toolbarActions}
      trailingActions={<ReportMoreMenu reportSlug={resolved.report.slug} />}
      onExport={() => downloadTodaysFollowUpsExport(filters)}
      state={state}
      emptyTitle="No records yet"
      emptyDescription="We couldn’t find any records matching your search or filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex flex-col">
        <ResponsiveTableContainer label="Today's Follow Ups">
          <Table<TodaysFollowUpRow>
            columns={COLUMNS}
            rows={rows}
            getRowId={(row) => row.id}
          />
        </ResponsiveTableContainer>

        <div className="border-t border-hairline p-4">
          <Pagination
            page={page}
            pageCount={Math.max(1, Math.ceil(total / size))}
            total={total}
            pageSize={size}
            onPageChange={setPage}
            onPageSizeChange={setSize}
            hideNavWhenSingle
          />
        </div>
      </div>
    </ReportShell>
  );
}
