"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { IconFilter as IconPipeline, IconUser } from "@tabler/icons-react";
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
import { ManageColumns } from "@/components/table/manage-columns";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { useAdvancedFilter } from "@/hooks/use-advanced-filter";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import { cn } from "@/lib/cn";
import { formatAED, formatDate } from "@/lib/format";
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
  downloadLeadsByOwnershipExport,
  fetchLeadsByOwnershipDetailed,
  fetchLeadsByOwnershipSummary,
  type LeadsByOwnershipFilters,
  type LeadsByOwnershipLeadRow,
  type OwnerCountRow,
} from "@/services/leads-by-ownership-report-service";
import type { TableColumn } from "@/types";

/** The legend id of the Unassigned bucket (its server row has a null ownerId). */
const UNASSIGNED_SLICE = "unassigned";

/** Rows differ by view: per-owner metrics (summary) or the underlying leads (detailed). */
type Row = OwnerCountRow | LeadsByOwnershipLeadRow;

/** A condition the Leads list understands; one per drill-able metric. */
type Condition = { field: string; operator: string; values: string[] };

/**
 * The count columns and the Leads-list condition that reproduces each — the same predicates
 * the server counted with (an existing report's own definition in every case), so the tab a
 * count opens shows exactly the counted leads.
 */
const COUNT_COLUMNS: readonly {
  key: keyof OwnerCountRow;
  header: string;
  condition: Condition | null;
}[] = [
  { key: "count", header: "Total Leads", condition: null },
  {
    key: "newCount",
    header: "New Leads",
    condition: { field: "status", operator: "is", values: ["New"] },
  },
  {
    key: "contactedCount",
    header: "Contacted Leads",
    condition: { field: "activity", operator: "is", values: ["Contacted"] },
  },
  {
    key: "noActivityCount",
    header: "No Activity Leads",
    condition: { field: "activity", operator: "is", values: ["No Activity"] },
  },
  {
    key: "convertedCount",
    header: "Converted Leads",
    condition: { field: "status", operator: "is", values: ["WON"] },
  },
  {
    key: "lostCount",
    header: "Lost Leads",
    condition: { field: "status", operator: "is", values: ["LOST"] },
  },
];

/** Assigned User is frozen to the left edge while the metrics scroll (the reference). */
const STICKY_FIRST =
  "sticky left-0 z-10 border-r border-hairline bg-surface group-hover:bg-canvas";

const COUNT_LINK_CLASS =
  "focus-ring rounded-sm text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted";

function percent(value: number | null) {
  return value === null ? (
    <span className="text-ink-subtle">—</span>
  ) : (
    `${value.toFixed(2)}%`
  );
}

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
 * The summary's columns, as the reference lays them out: the owner (frozen), six underlined
 * counts that open the Leads list narrowed to that owner and metric in a new tab, then the
 * ratios, the target and the owner's total lead value.
 */
function summaryColumns(
  leadsHref: (row: OwnerCountRow, condition: Condition | null) => string,
): readonly TableColumn<OwnerCountRow>[] {
  return [
    {
      key: "owner",
      header: "Assigned User",
      className: STICKY_FIRST,
      render: (row) =>
        row.ownerId ? (
          row.ownerName
        ) : (
          <span className="text-ink-subtle">{row.ownerName}</span>
        ),
    },
    ...COUNT_COLUMNS.map(
      ({ key, header, condition }): TableColumn<OwnerCountRow> => ({
        key,
        header,
        align: "right",
        render: (row) => (
          <Link
            href={leadsHref(row, condition)}
            target="_blank"
            rel="noopener"
            aria-label={`Open ${row.ownerName}'s ${header.toLowerCase()} in a new tab`}
            className={COUNT_LINK_CLASS}
          >
            {(row[key] as number).toLocaleString("en-US")}
          </Link>
        ),
      }),
    ),
    {
      key: "conversionRatio",
      header: "Conversion Ratio",
      align: "right",
      render: (row) => percent(row.conversionRatio),
    },
    {
      // Emarath has no qualification stage or flag, so the server sends null.
      key: "qualifiedRatio",
      header: "Qualified Ratio",
      align: "right",
      render: (row) => percent(row.qualifiedRatio),
    },
    {
      // Emarath has no sales-target model, so the server sends null.
      key: "targetAchievement",
      header: "Target Achievement",
      align: "right",
      render: (row) =>
        row.targetAchievement === null ? (
          <span className="text-ink-muted">No Target Set</span>
        ) : (
          percent(row.targetAchievement)
        ),
    },
    {
      key: "leadValue",
      header: "Total Lead Value",
      align: "right",
      render: (row) => formatAED(row.leadValue),
    },
  ];
}

/** Remembers this report's detailed-column arrangement separately from every other module. */
const COLUMN_PREFS_MODULE = "reports:leads-by-ownership";

/** The Leads list's column for a key — the same cell the list renders, fed by the same field. */
function leadColumn(key: string): TableColumn<LeadsByOwnershipLeadRow> {
  const column = leadColumns.find((candidate) => candidate.key === key);
  if (!column) throw new Error(`The Leads list has no "${key}" column`);
  return column;
}

/** dd-mm-yyyy, as the reference prints its date columns; an absent date dashes. */
function DateCell({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-ink-subtle">—</span>;
  return <span>{formatDate(iso)}</span>;
}

/**
 * The detailed view's 29 columns in the reference's left-to-right order. All but four are the
 * Leads list's own columns (`leadColumns`) — same cell, same formatting, same field — so a
 * value can never print differently here than on the list. The report owns Created Date
 * (date-only here), Customer Name (a link to the Customer Details page), Assigned (its avatar
 * row) and Lead Status (tinted from the server-resolved stage colour).
 */
const DETAILED_COLUMNS: readonly TableColumn<LeadsByOwnershipLeadRow>[] = [
  leadColumn("assignedDate"),
  {
    key: "createdAt",
    header: "Created Date",
    render: (row) => <DateCell iso={row.createdAt} />,
  },
  {
    key: "name",
    header: "Customer Name",
    render: (row) => <CustomerNameLink leadId={row.id} name={row.name} />,
  },
  leadColumn("primaryPhone"),
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
  leadColumn("country"),
  leadColumn("state"),
  leadColumn("street"),
  leadColumn("city"),
  leadColumn("nationalCode"),
  leadColumn("bookingDate"),
  leadColumn("pipeline"),
  leadColumn("category"),
  leadColumn("actualAmount"),
  leadColumn("forecastedAmount"),
  leadColumn("paymentMethod"),
];

/**
 * Leads By Ownership report (RPT-02.5). Renders inside the shared ReportShell (RPT-01.2): it
 * owns the toolbar filters and the data, the shell owns the chrome and the loading/empty/error
 * states. Summary view sits the donut + legend beside per-owner metrics (grouped in the DB);
 * detailed view lists the underlying leads, paginated. Every filter — Sales Agent, Pipeline,
 * By Date and the Filter condition builder — is a real server query param, so the ring, the
 * counts and the export always describe the same set.
 */
export function LeadsByOwnershipReport({
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
  const pipelines = useLookup("pipelines");

  const view: ReportViewMode =
    params.get("view") === "detailed" ? "detailed" : "summary";
  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const dateField: LeadsByStatusDateField =
    params.get("dateField") === "statusChanged" ? "statusChanged" : "created";
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";
  const unassignedOnly = params.get("unassigned") === "true";

  const agentIds = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );

  const filters: LeadsByOwnershipFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      dateField,
      agent: agentIds,
      pipeline: pipelineKey || undefined,
      conditions: advancedFilter.appliedConditions,
      unassigned: unassignedOnly || undefined,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      dateField,
      agentIds,
      pipelineKey,
      advancedFilter.appliedConditions,
      unassignedOnly,
    ],
  );

  const dataSource: ListDataSource<Row> = useCallback(
    (listQuery, signal) =>
      view === "summary"
        ? fetchLeadsByOwnershipSummary(filters, signal)
        : fetchLeadsByOwnershipDetailed(
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

  /** A legend row opens the Detailed view narrowed to that owner — or to the unassigned leads. */
  const drillDown = useCallback(
    (sliceId: string) => {
      setParams(
        sliceId === UNASSIGNED_SLICE
          ? { view: "detailed", unassigned: "true", agent: null }
          : { view: "detailed", agent: sliceId, unassigned: null },
      );
      resetPage();
    },
    [setParams, resetPage],
  );

  /**
   * The Leads list, narrowed to exactly what a count counted: this owner (or no owner), the
   * metric's own condition, and every filter the report is running under.
   */
  const leadsHref = useCallback(
    (row: OwnerCountRow, metric: Condition | null) => {
      const conditions: Condition[] = [
        row.ownerId
          ? { field: "assignedAgent", operator: "is", values: [row.ownerId] }
          : { field: "assignedAgent", operator: "isEmpty", values: [] },
      ];
      if (metric) conditions.push(metric);
      if (filters.pipeline)
        conditions.push({
          field: "pipeline",
          operator: "is",
          values: [filters.pipeline],
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

  const { prefs, setPrefs, visibleColumns } = useColumnPrefs(
    COLUMN_PREFS_MODULE,
    DETAILED_COLUMNS,
  );

  if (!resolved) notFound();

  const state: ReportState = isLoading
    ? "loading"
    : isError
      ? "error"
      : rows.length > 0
        ? "ready"
        : "empty";

  // The summary endpoint answers with every owner at once, so the footer's rows-per-page
  // pages the rows already in hand — display paging, never a second source of truth.
  const summaryRows = view === "summary" ? (rows as OwnerCountRow[]) : [];
  const summaryPageCount = Math.max(1, Math.ceil(summaryRows.length / size));
  const summaryPage = Math.min(page, summaryPageCount);
  const summaryVisible = summaryRows.slice(
    (summaryPage - 1) * size,
    summaryPage * size,
  );
  // Per-owner counts sum past the distinct total (a co-assigned lead counts for each owner),
  // so the ring is shares of that sum while the centre keeps the distinct total.
  const sliceTotal = summaryRows.reduce((sum, row) => sum + row.count, 0);

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
      <LeadFilterBuilder filter={advancedFilter} label="Leads By Ownership" />
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
          <BreakdownDonutChart
            subject="leads by owner"
            total={total}
            sliceTotal={sliceTotal}
            onSelect={drillDown}
            // Every table row is a slice — the Unassigned bucket included, since that is the
            // workload a manager rebalances — so the ring and the table read the same data.
            slices={summaryRows.map((row, index) => {
              const colors = DONUT_PALETTE[index % DONUT_PALETTE.length];
              return {
                id: row.ownerId ?? UNASSIGNED_SLICE,
                label: row.ownerName,
                count: row.count,
                arcClass: colors.arc,
                swatchClass: colors.swatch,
              };
            })}
          />
        ) : undefined
      }
      onExport={() => downloadLeadsByOwnershipExport(filters)}
      state={state}
      emptyTitle="No leads to show"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex min-h-0 flex-col">
        <ResponsiveTableContainer label="Leads By Ownership">
          {view === "summary" ? (
            <Table<OwnerCountRow>
              columns={summaryTableColumns}
              rows={summaryVisible}
              getRowId={(row) => row.ownerId ?? "unassigned"}
            />
          ) : (
            <Table<LeadsByOwnershipLeadRow>
              columns={visibleColumns}
              rows={rows as LeadsByOwnershipLeadRow[]}
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
