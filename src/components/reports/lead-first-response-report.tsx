"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  IconAlertTriangle,
  IconClock,
  IconClock24,
  IconPhoneCall,
  IconSettings,
  IconTag,
  IconUser,
  IconUserOff,
  IconUsers,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { LeadFirstResponseSettingsDrawer } from "./lead-first-response-settings-drawer";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMetricCard } from "./report-metric-card";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { ReportShell, type ReportState } from "./report-shell";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { formatDateTime } from "@/lib/format";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  isDatePeriodKey,
  periodRange,
} from "@/services/leads-by-status-report-service";
import {
  ACTIVITY_TYPES,
  DEFAULT_LATE_HOURS,
  downloadLeadFirstResponseExport,
  fetchLeadFirstResponseRecords,
  fetchLeadFirstResponseSummary,
  type ContactFilter,
  type LeadFirstResponseFilters,
  type LeadFirstResponseRow,
  type LeadFirstResponseSummary,
} from "@/services/lead-first-response-report-service";
import {
  fetchFirstResponseSettings,
  saveFirstResponseSettings,
  type FirstResponseSettings,
} from "@/services/view-preferences-service";
import type { TableColumn } from "@/types";

/** The records tabs, in the reference's order. */
const TABS: readonly { key: ContactFilter; label: string }[] = [
  { key: "all", label: "All Leads" },
  { key: "contacted", label: "Contacted" },
  { key: "untouched", label: "Untouched" },
];

/** "2 hrs 22 m" — the reference's own wording for a response span. */
function formatMinutes(total: number | null): string {
  if (total === null) return "—";
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  if (hours === 0) return `${minutes} m`;
  return `${hours} hrs ${minutes} m`;
}

function AssignedCell({
  agents,
}: {
  agents: LeadFirstResponseRow["assignedTo"];
}) {
  if (agents.length === 0) return null;
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

/** A muted em dash, as the reference prints every unknown cell. */
function Dash() {
  return <span className="text-ink-subtle">--</span>;
}

/**
 * Lead First Response (RPT-02.9). A single view, as the reference has it: the metric
 * cards, the records tabs and the records table all read the one scoped query, so a
 * filter moves every number on the page together.
 *
 * "First response" is the gap from a lead's creation to the first time anyone worked it —
 * its earliest completed activity or logged call, the engagement signal the No Activity,
 * Today Leads and Lead Aging reports share. The server computes it; the browser never
 * re-derives a span it was given.
 */
export function LeadFirstResponseReport({
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
  const { query, page, size, sort, setPage, setSize, setSort, resetPage } =
    useListQuery({ size: 100 });

  const [options, setOptions] = useState<LeadFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {
        // Agent/source options are non-critical: the report still runs without them.
      });
    return () => controller.abort();
  }, []);

  const [settings, setSettings] = useState<FirstResponseSettings>({
    lateHours: DEFAULT_LATE_HOURS,
  });
  useEffect(() => {
    const controller = new AbortController();
    fetchFirstResponseSettings(controller.signal)
      .then(setSettings)
      .catch(() => {
        // Non-critical: the report counts against the shipped default until it lands.
      });
    return () => controller.abort();
  }, []);
  const [configuring, setConfiguring] = useState(false);
  const [reloadNonce, setReloadNonce] = useState(0);

  const sources = useLookup("sources");

  const searchParam = params.get("search") ?? "";
  const [searchDraft, setSearchDraft] = useState(searchParam);
  const search = useDebouncedValue(searchDraft, 300);
  const agentKey = params.get("agent") ?? "";
  const sourceKey = params.get("source") ?? "";
  const typeKey = params.get("activityType") ?? "";
  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const tab = (params.get("contact") ?? "all") as ContactFilter;

  const split = (value: string) =>
    value ? value.split(",").filter(Boolean) : [];
  const agentIds = useMemo(() => split(agentKey), [agentKey]);
  const sourceValues = useMemo(() => split(sourceKey), [sourceKey]);
  const typeValues = useMemo(() => split(typeKey), [typeKey]);

  /** The page-wide query: the cards read this with the tab left off. */
  const filters: LeadFirstResponseFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      search: search || undefined,
      agent: agentIds,
      source: sourceValues,
      activityType: typeValues,
      lateHours: settings.lateHours,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      search,
      agentIds,
      sourceValues,
      typeValues,
      settings.lateHours,
    ],
  );
  const recordFilters: LeadFirstResponseFilters = useMemo(
    () => ({ ...filters, contact: tab }),
    [filters, tab],
  );

  // The last good summary stays on screen while the next loads, so a filter change never
  // blanks the cards or the tabs — only the numbers go quiet.
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const [result, setResult] = useState<{
    key: string;
    data: LeadFirstResponseSummary | null;
    error: boolean;
  }>({ key: "", data: null, error: false });

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFirstResponseSummary(filters, controller.signal)
      .then((data) => setResult({ key: filterKey, data, error: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setResult({ key: filterKey, data: null, error: true });
      });
    return () => controller.abort();
  }, [filters, filterKey, reloadNonce]);

  const summary = result.data;
  const isRefreshing = result.key !== filterKey;
  const summaryError = result.key === filterKey && result.error;

  const dataSource: ListDataSource<LeadFirstResponseRow> = useCallback(
    (listQuery, signal) =>
      fetchLeadFirstResponseRecords(
        listQuery.page,
        listQuery.size,
        recordFilters,
        listQuery.sort,
        signal,
      ),
    [recordFilters],
  );
  const listKey = useMemo(
    () => ({ ...query, activeFilters: recordFilters }),
    [query, recordFilters],
  );
  const {
    rows,
    total,
    isLoading: recordsLoading,
    isError: recordsError,
    refetch,
  } = useListData<LeadFirstResponseRow>(dataSource, listKey);

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

  // The debounced search rides the URL, so a reload keeps it and the pager resets with it.
  useEffect(() => {
    if (search === searchParam) return;
    setParams({ search: search || null });
    resetPage();
  }, [search, searchParam, setParams, resetPage]);

  const columns: readonly TableColumn<LeadFirstResponseRow>[] = useMemo(
    () => [
      {
        key: "name",
        header: "Lead Name",
        sortable: true,
        render: (row) => (
          <CustomerNameLink
            leadId={row.id}
            name={row.name}
            from="lead-first-response"
          />
        ),
      },
      {
        key: "assigned",
        header: "Assigned User",
        render: (row) => <AssignedCell agents={row.assignedTo} />,
      },
      {
        key: "source",
        header: "Lead Source",
        sortable: true,
        render: (row) =>
          row.source ? (
            <span className="inline-flex max-w-full items-center truncate rounded-control bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
              {row.source}
            </span>
          ) : (
            <Dash />
          ),
      },
      {
        key: "createdAt",
        header: "Lead Created",
        sortable: true,
        render: (row) => formatDateTime(row.createdAt),
      },
      {
        key: "firstActivityAt",
        header: "First Activity",
        sortable: true,
        render: (row) =>
          row.firstActivityAt ? formatDateTime(row.firstActivityAt) : <Dash />,
      },
      {
        key: "activityType",
        header: "Activity Type",
        sortable: true,
        render: (row) =>
          row.activityType ? (
            <span className="inline-flex items-center rounded-control bg-canvas px-2 py-0.5 text-xs font-medium text-ink">
              {row.activityType}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-control bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
              <IconAlertTriangle size={13} stroke={2} aria-hidden="true" />
              No Activity
            </span>
          ),
      },
      {
        key: "firstResponseMinutes",
        header: "First Response Time",
        sortable: true,
        align: "right",
        render: (row) =>
          row.firstResponseMinutes === null ? (
            <Dash />
          ) : (
            formatMinutes(row.firstResponseMinutes)
          ),
      },
      {
        key: "followUpAt",
        header: "Follow-up Date",
        sortable: true,
        render: (row) =>
          row.followUpAt ? formatDateTime(row.followUpAt) : <Dash />,
      },
    ],
    [],
  );

  if (!resolved) notFound();

  // Only the very first load (or a failure with nothing to show) takes over the page.
  const state: ReportState =
    summary === null ? (summaryError ? "error" : "loading") : "ready";
  const kpis = summary?.kpis;
  const tabs = summary?.tabs;

  const filterBar = (
    // One row, as the reference has it: the controls never wrap onto a second line —
    // on a narrow viewport the cluster scrolls sideways instead.
    <div className="scrollbar-none flex min-w-0 flex-nowrap items-center gap-1 overflow-x-auto empty:hidden">
      <ToolbarSearch
        value={searchDraft}
        onChange={setSearchDraft}
        placeholder="Search"
      />
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
        label="All Sources"
        icon={IconTag}
        multiple
        searchable
        value={sourceValues}
        onChange={(value) => {
          setParams({ source: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={sources.options.map((option) => ({
          value: option.value,
          label: option.label,
        }))}
      />
      <ReportToolbarSelect
        label="Activity Type"
        icon={IconClock}
        multiple
        value={typeValues}
        onChange={(value) => {
          setParams({ activityType: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={[...ACTIVITY_TYPES]}
      />
      <ReportDateFilter
        showActiveLabel
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
      <button
        type="button"
        onClick={() => setConfiguring(true)}
        className={cn(TOOLBAR_BUTTON_CLASS, "shrink-0")}
      >
        <IconSettings size={18} stroke={1.75} aria-hidden="true" />
        Report Settings
      </button>
    </div>
  );

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      bare
      noWrap
      toolbarActions={filterBar}
      trailingActions={<ReportMoreMenu reportSlug={slug} />}
      onExport={() => downloadLeadFirstResponseExport(recordFilters)}
      state={state}
      emptyTitle="No leads to show"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={() => {
        setReloadNonce((value) => value + 1);
        refetch();
      }}
    >
      <div className="flex flex-col gap-4">
        {/* Metric cards — dimmed, not unmounted, while the next summary loads. */}
        {kpis && (
          <div
            aria-busy={isRefreshing}
            className={cn(
              "scrollbar-slim flex gap-4 overflow-x-auto pb-1 transition-opacity duration-(--duration-shell) ease-shell",
              isRefreshing && "opacity-60",
            )}
          >
            <ReportMetricCard
              title="Total Leads"
              icon={IconUsers}
              tone="blue"
              value={kpis.totalLeads.toLocaleString("en-US")}
              label="In selected period"
            />
            <ReportMetricCard
              title="Contacted"
              hint="Leads someone has worked — a completed activity or a logged call."
              icon={IconPhoneCall}
              tone="emerald"
              value={`${kpis.contacted.toLocaleString("en-US")} / ${kpis.totalLeads.toLocaleString("en-US")}`}
              label={
                <>
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 font-medium text-emerald-800">
                    {kpis.contactRate}%
                  </span>{" "}
                  contact rate
                </>
              }
            />
            <ReportMetricCard
              title="Avg. First Response"
              icon={IconClock}
              tone="amber"
              value={formatMinutes(kpis.avgFirstResponseMinutes)}
              label="Across contacted leads"
            />
            <ReportMetricCard
              title="Untouched Leads"
              hint="Leads with no completed activity and no logged call."
              icon={IconUserOff}
              tone="red"
              value={kpis.untouched.toLocaleString("en-US")}
              label={
                <>
                  <span className="rounded-full bg-red-100 px-1.5 py-0.5 font-medium text-red-800">
                    {kpis.untouchedRate}%
                  </span>{" "}
                  of total leads
                </>
              }
            />
            <ReportMetricCard
              title={`Responded > ${settings.lateHours} hrs`}
              icon={IconClock24}
              tone="yellow"
              value={kpis.respondedLate.toLocaleString("en-US")}
              label={`${kpis.lateRate}% of contacted`}
            />
          </div>
        )}

        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="flex items-center gap-3">
              <h2 className="text-lg font-semibold text-ink">Lead Records</h2>
              <span className="rounded-full bg-canvas px-2.5 py-1 text-xs font-medium text-ink-muted">
                {total.toLocaleString("en-US")} records
              </span>
            </div>

            {/* The records tabs. Counts come from the cards' own query, so clicking one
                never changes the numbers beside it. */}
            <div className="flex items-center gap-1 rounded-control border border-hairline p-1">
              {TABS.map((entry) => {
                const active = tab === entry.key;
                return (
                  <button
                    key={entry.key}
                    type="button"
                    aria-pressed={active}
                    onClick={() => {
                      setParams({
                        contact: entry.key === "all" ? null : entry.key,
                      });
                      resetPage();
                    }}
                    className={cn(
                      "focus-ring flex items-center gap-2 rounded-control px-3 py-1.5 text-sm transition-colors duration-(--duration-shell) ease-shell",
                      active
                        ? "bg-brand font-medium text-white"
                        : "text-ink hover:bg-canvas",
                    )}
                  >
                    {entry.label}
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs",
                        active ? "bg-white/25" : "bg-canvas text-ink-muted",
                      )}
                    >
                      {(tabs?.[entry.key] ?? 0).toLocaleString("en-US")}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <ResponsiveTableContainer
            label="Lead Records"
            className="max-h-[32rem]"
          >
            <Table<LeadFirstResponseRow>
              columns={columns}
              rows={rows}
              getRowId={(row) => row.id}
              sort={sort}
              onSortChange={setSort}
              sortTooltips
              isLoading={recordsLoading}
              // Untouched leads carry the reference's amber tint.
              rowClassName={(row) =>
                row.firstActivityAt === null ? "bg-amber-50/60" : undefined
              }
              errorState={
                recordsError ? (
                  <ErrorState
                    title="Couldn’t load the lead records"
                    description="Something went wrong while loading these leads. Check your connection and try again."
                    onRetry={refetch}
                  />
                ) : undefined
              }
              emptyState={
                <EmptyState
                  icon={IconClock}
                  title="No lead records"
                  description="No leads match the selected filters."
                />
              }
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
            />
          </div>
        </Card>
      </div>

      {configuring && (
        <LeadFirstResponseSettingsDrawer
          open
          value={settings}
          onClose={() => setConfiguring(false)}
          onSave={async (next: FirstResponseSettings) => {
            const saved = await saveFirstResponseSettings(next);
            setSettings(saved);
            setConfiguring(false);
            resetPage();
          }}
        />
      )}
    </ReportShell>
  );
}
