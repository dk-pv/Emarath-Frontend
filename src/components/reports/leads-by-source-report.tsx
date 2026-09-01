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
  IconAffiliate,
  IconFilter as IconPipeline,
  IconUser,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { BreakdownDonutChart, DONUT_PALETTE } from "./breakdown-donut-chart";
import { ReportDateFilter } from "./report-date-filter";
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
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LeadFilterBuilder } from "@/components/leads/lead-filter-builder";
import { leadColumns } from "@/components/leads/lead-columns";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useAdvancedFilter } from "@/hooks/use-advanced-filter";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
  type LeadListItem,
} from "@/services/leads-service";
import {
  isDatePeriodKey,
  periodRange,
  type LeadsByStatusDateField,
} from "@/services/leads-by-status-report-service";
import {
  NO_SOURCE_LABEL,
  downloadLeadsBySourceExport,
  fetchLeadsBySourceDetailed,
  fetchLeadsBySourceSummary,
  type LeadsBySourceFilters,
  type LeadsBySourceLeadRow,
  type SourceCountRow,
} from "@/services/leads-by-source-report-service";
import type { TableColumn } from "@/types";

/** Rows differ by view: per-source counts (summary) or the underlying leads (detailed). */
type Row = SourceCountRow | LeadsBySourceLeadRow;

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

function AssignedCell({ agents }: { agents: LeadListItem["assignedAgents"] }) {
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
 * The summary's columns, as the reference lays them out: Lead Source, an underlined count
 * that opens the Leads list narrowed by `leadsHref` (so the rows it opens are exactly the
 * rows it counted), the bucket's share of the filtered total, and its conversion rate.
 */
function summaryColumns(
  leadsHref: (source: string) => string,
): readonly TableColumn<SourceCountRow>[] {
  return [
    { key: "source", header: "Lead Source", render: (row) => row.source },
    {
      key: "count",
      header: "No. of Leads",
      align: "right",
      render: (row) => (
        <Link
          href={leadsHref(row.source)}
          target="_blank"
          rel="noopener"
          aria-label={`Open the ${row.count} leads from ${row.source} in a new tab`}
          className="focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
        >
          {row.count.toLocaleString("en-US")}
        </Link>
      ),
    },
    {
      // The server computes share of the FILTERED total, so the column, the ring and the
      // counts all describe the same set.
      key: "share",
      header: "Share",
      align: "right",
      render: (row) => `${row.share.toFixed(2)} %`,
    },
    {
      key: "conversionRate",
      header: "Conversion Rate",
      align: "right",
      render: (row) => `${row.conversionRate.toFixed(2)} %`,
    },
  ];
}

/** The Leads list's column for a key — the same cell the list renders, fed by the same field. */
function leadColumn(key: string): TableColumn<LeadsBySourceLeadRow> {
  const column = leadColumns.find((candidate) => candidate.key === key);
  if (!column) throw new Error(`The Leads list has no "${key}" column`);
  return column;
}

/**
 * The detailed view's 26 columns in the requested order. All but three are the Leads list's
 * own columns (`leadColumns`) — same cell, same formatting, same field — so a value can never
 * print differently here than on the list. The report owns Customer Name (a link to the Customer Details page),
 * Assigned (its avatar row) and Lead Status (tinted from the server-resolved stage colour).
 */
const DETAILED_COLUMNS: readonly TableColumn<LeadsBySourceLeadRow>[] = [
  leadColumn("primaryPhone"),
  {
    key: "name",
    header: "Customer Name",
    render: (row) => (
      <CustomerNameLink
        leadId={row.id}
        name={row.name}
        from="leads-by-source"
      />
    ),
  },
  leadColumn("firstName"),
  leadColumn("secondaryPhone"),
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedAgents} />,
  },
  {
    key: "status",
    header: "Lead Status",
    render: (row) => <StatusPill status={row.status} color={row.statusColor} />,
  },
  leadColumn("complaints"),
  leadColumn("language"),
  leadColumn("source"),
  leadColumn("product"),
  leadColumn("productQty"),
  leadColumn("product2"),
  leadColumn("product2Qty"),
  leadColumn("callStatus"),
  leadColumn("callAttempts"),
  leadColumn("whatsappAttempts"),
  leadColumn("pipeline"),
  leadColumn("category"),
  leadColumn("actualAmount"),
  leadColumn("forecastedAmount"),
  leadColumn("paymentMethod"),
  leadColumn("country"),
  leadColumn("state"),
  leadColumn("street"),
  leadColumn("city"),
  leadColumn("nationalCode"),
];

/**
 * Leads By Source report (RPT-02.4). Renders inside the shared ReportShell (RPT-01.2): it owns
 * the toolbar filters and the data, the shell owns the chrome and the loading/empty/error
 * states. Summary view sits the donut + legend beside per-source counts and conversion rates
 * (grouped in the DB); detailed view lists the underlying leads, paginated. Every filter —
 * Sales Agent, Pipeline, Lead Source, By Date and the Filter condition builder — is a real
 * server query param, so the ring, the counts and the export always describe the same set.
 */
export function LeadsBySourceReport({
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
        // Agent options are non-critical: the report still runs without them.
      });
    return () => controller.abort();
  }, []);

  // The "Filter" popover is the shared Leads condition builder (ADR-0039/0052); its
  // applied `conditions` payload rides every report query beside the toolbar pills.
  const advancedFilter = useAdvancedFilter({ onApplied: resetPage });

  // Pipelines and the source catalogue come from the shared lookups the New Lead form reads.
  const pipelines = useLookup("pipelines");
  const sources = useLookup("sources");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const dateField: LeadsByStatusDateField =
    params.get("dateField") === "statusChanged" ? "statusChanged" : "created";
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const sourceKey = params.get("source") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";

  const split = (value: string) =>
    value ? value.split(",").filter(Boolean) : [];
  const agentIds = useMemo(() => split(agentKey), [agentKey]);
  const sourceValues = useMemo(() => split(sourceKey), [sourceKey]);
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );

  const filters: LeadsBySourceFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      dateField,
      agent: agentIds,
      source: sourceValues,
      pipeline: pipelineKey || undefined,
      conditions: advancedFilter.appliedConditions,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      dateField,
      agentIds,
      sourceValues,
      pipelineKey,
      advancedFilter.appliedConditions,
    ],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchLeadsBySourceSummary(filters, signal)
        : fetchLeadsBySourceDetailed(
            listQuery.page,
            listQuery.size,
            filters,
            signal,
          ),
    [view, filters],
  );

  // Fold view + filters into the list key so a view/filter switch marks the previous rows
  // stale instead of handing the other view's row shape to this view's table.
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

  /** A legend row opens the Detailed view narrowed to that source (in-report). */
  const drillDown = useCallback(
    (source: string) => {
      setParams({ view: "detailed", source });
      resetPage();
    },
    [setParams, resetPage],
  );

  /**
   * The Leads list, narrowed to exactly what a count counted: this source (or no source),
   * plus every filter the report is running under — so the tab that opens shows the same
   * leads the number described.
   */
  const leadsHref = useCallback(
    (source: string) => {
      const conditions: {
        field: string;
        operator: string;
        values: string[];
      }[] = [
        source === NO_SOURCE_LABEL
          ? { field: "source", operator: "isEmpty", values: [] }
          : { field: "source", operator: "is", values: [source] },
      ];
      if (filters.pipeline)
        conditions.push({
          field: "pipeline",
          operator: "is",
          values: [filters.pipeline],
        });
      if (filters.agent?.length)
        conditions.push({
          field: "assignedAgent",
          operator: "is",
          values: filters.agent,
        });
      if (filters.from && filters.to)
        conditions.push({
          field:
            filters.dateField === "statusChanged"
              ? "statusChangedAt"
              : "createdAt",
          operator: "between",
          values: [filters.from, filters.to],
        });
      if (filters.conditions) {
        const extra: unknown = JSON.parse(filters.conditions);
        if (Array.isArray(extra)) conditions.push(...extra);
      }
      return `/leads?conditions=${encodeURIComponent(JSON.stringify(conditions))}`;
    },
    [filters],
  );
  const summaryTableColumns = useMemo(
    () => summaryColumns(leadsHref),
    [leadsHref],
  );

  if (!resolved) notFound();

  const state: ReportState = isLoading
    ? "loading"
    : isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  // The summary endpoint answers with every source at once, so the footer's rows-per-page
  // pages the rows already in hand — display paging, never a second source of truth.
  const summaryRows = view === "summary" ? (rows as SourceCountRow[]) : [];
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
        label="Lead Source"
        icon={IconAffiliate}
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
      <ReportDateFilter
        value={{
          field: dateField,
          period: periodKey,
          from: customFrom,
          to: customTo,
        }}
        onApply={(next) => {
          setParams({
            period: next.period,
            dateField: next.field === "created" ? null : next.field,
            from: next.period === "custom" ? (next.from ?? null) : null,
            to: next.period === "custom" ? (next.to ?? null) : null,
          });
          resetPage();
        }}
        onClear={() => {
          setParams({ period: null, dateField: null, from: null, to: null });
          resetPage();
        }}
      />
      <LeadFilterBuilder filter={advancedFilter} label="Leads By Source" />
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
      toolbarActions={filterBar}
      trailingActions={<ReportMoreMenu reportSlug={slug} />}
      aside={
        view === "summary" && state === "ready" ? (
          <BreakdownDonutChart
            subject="leads by source"
            total={total}
            onSelect={drillDown}
            slices={summaryRows.map((row, index) => {
              const colors = DONUT_PALETTE[index % DONUT_PALETTE.length];
              return {
                id: row.source,
                label: row.source,
                count: row.count,
                arcClass: colors.arc,
                swatchClass: colors.swatch,
              };
            })}
          />
        ) : undefined
      }
      onExport={() => downloadLeadsBySourceExport(filters)}
      state={state}
      emptyTitle="No leads to show"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex min-h-0 flex-col">
        <ResponsiveTableContainer label="Leads By Source">
          {view === "summary" ? (
            <Table<SourceCountRow>
              columns={summaryTableColumns}
              rows={summaryVisible}
              getRowId={(row) => row.source}
            />
          ) : (
            <Table<LeadsBySourceLeadRow>
              columns={DETAILED_COLUMNS}
              rows={rows as LeadsBySourceLeadRow[]}
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
