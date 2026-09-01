"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { IconFilter as IconPipeline, IconUser } from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { ReportShell, type ReportState } from "./report-shell";
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
import { formatDate, formatDuration } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import { tagPillClass } from "@/lib/tag-palette";
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
  downloadConvertedLeadsExport,
  fetchConvertedLeadsDetailed,
  type ConvertedLeadRow,
  type ConvertedLeadsFilters,
} from "@/services/converted-leads-report-service";
import type { TableColumn } from "@/types";

/** Remembers this report's column arrangement separately from every other module. */
const COLUMN_PREFS_MODULE = "reports:converted-leads";

/** Hidden until turned on in Manage Columns, so the default table is exactly the reference's 31. */
const DEFAULT_HIDDEN_COLUMNS = ["conversionTime"];

/** Tags is frozen to the left edge while the rest scrolls (the reference). */
const STICKY_FIRST =
  "sticky left-0 z-10 border-r border-hairline bg-surface group-hover:bg-canvas";

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

/** The Leads list's column for a key — the same cell the list renders, fed by the same field. */
function leadColumn(key: string): TableColumn<ConvertedLeadRow> {
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
 * The single view's 31 columns in the reference's left-to-right order. All but five are the
 * Leads list's own columns (`leadColumns`) — same cell, same formatting, same field — so a
 * value can never print differently here than on the list. The report owns Tags (frozen),
 * Customer Name (a link to the Customer Details page), Converted Date (`statusChangedAt` —
 * when the lead became WON), Lead Status (tinted from the server-resolved stage colour),
 * Assigned (its avatar row) and Created Date (date-only here).
 */
const DETAILED_COLUMNS: readonly TableColumn<ConvertedLeadRow>[] = [
  {
    // Report-owned Tags cell, matched to the reference: pills centred in a fixed-width
    // frozen column, kept to ONE line — with several tags each pill shrinks and its label
    // truncates ("QC VERIF…") instead of wrapping the row taller. The Leads list keeps its
    // own editable, wrapping cell.
    key: "tags",
    header: "Tags",
    className: STICKY_FIRST,
    render: (row) =>
      row.tags.length === 0 ? (
        <div className="w-72 text-center text-ink-subtle">—</div>
      ) : (
        <div className="flex w-72 items-center justify-center gap-1.5">
          {row.tags.map((tag) => (
            <span
              key={tag.id}
              className={cn(tagPillClass(tag.name), "min-w-0 shrink")}
            >
              <span className="truncate">{tag.name}</span>
            </span>
          ))}
        </div>
      ),
  },
  {
    key: "name",
    header: "Customer Name",
    render: (row) => (
      <CustomerNameLink
        leadId={row.id}
        name={row.name}
        from="converted-leads"
      />
    ),
  },
  leadColumn("primaryPhone"),
  {
    key: "convertedAt",
    header: "Converted Date",
    render: (row) => <DateCell iso={row.convertedAt} />,
  },
  {
    // The sprint's "conversion timing": created → converted (statusChangedAt). Hidden by
    // default so the visible table stays the reference's exact 31 columns; Manage Columns
    // turns it on. Reads the two server instants — no third field to drift.
    key: "conversionTime",
    header: "Conversion Time",
    align: "right",
    render: (row) =>
      formatDuration(row.createdAt, row.convertedAt) ?? (
        <span className="text-ink-subtle">—</span>
      ),
  },
  {
    key: "status",
    header: "Lead Status",
    render: (row) => <StatusPill status={row.status} color={row.statusColor} />,
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedAgents} />,
  },
  leadColumn("secondaryPhone"),
  leadColumn("country"),
  leadColumn("city"),
  leadColumn("state"),
  leadColumn("product"),
  leadColumn("productQty"),
  leadColumn("product2"),
  leadColumn("product2Qty"),
  leadColumn("actualAmount"),
  leadColumn("paymentMethod"),
  leadColumn("nationalCode"),
  leadColumn("source"),
  leadColumn("street"),
  leadColumn("assignedDate"),
  {
    key: "createdAt",
    header: "Created Date",
    render: (row) => <DateCell iso={row.createdAt} />,
  },
  leadColumn("firstName"),
  leadColumn("complaints"),
  leadColumn("language"),
  leadColumn("callStatus"),
  leadColumn("callAttempts"),
  leadColumn("whatsappAttempts"),
  leadColumn("bookingDate"),
  leadColumn("pipeline"),
  leadColumn("category"),
  leadColumn("forecastedAmount"),
];

/**
 * Converted Leads report (RPT-02.6). Renders inside the shared ReportShell (RPT-01.2) as a
 * single detailed view — the reference has no Summary/Detailed toggle, so the shell's view
 * props are omitted and the toggle never renders. "Converted" is the approved `status = WON`
 * definition the Leads quick filter and the ownership metrics share. Every filter — Sales
 * Agent, Pipeline, By Date (created or converted date) and the Filter condition builder —
 * is a real server query param, so the table and the export always describe the same set.
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
        // Agent options are non-critical: the report still runs without them.
      });
    return () => controller.abort();
  }, []);

  const advancedFilter = useAdvancedFilter({ onApplied: resetPage });
  const pipelines = useLookup("pipelines");

  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const dateField: LeadsByStatusDateField =
    params.get("dateField") === "statusChanged" ? "statusChanged" : "created";
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const pipelineKey = params.get("pipeline") ?? "";

  const agentIds = useMemo(
    () => (agentKey ? agentKey.split(",").filter(Boolean) : []),
    [agentKey],
  );
  const pipelineValues = useMemo(
    () => (pipelineKey ? [pipelineKey] : []),
    [pipelineKey],
  );

  const filters: ConvertedLeadsFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      dateField,
      agent: agentIds,
      pipeline: pipelineKey || undefined,
      conditions: advancedFilter.appliedConditions,
    }),
    [
      periodKey,
      customFrom,
      customTo,
      dateField,
      agentIds,
      pipelineKey,
      advancedFilter.appliedConditions,
    ],
  );

  const dataSource: ListDataSource<ConvertedLeadRow> = useCallback(
    (listQuery, signal) =>
      fetchConvertedLeadsDetailed(
        listQuery.page,
        listQuery.size,
        filters,
        signal,
      ),
    [filters],
  );
  const listKey = useMemo(
    () => ({ ...query, activeFilters: filters }),
    [query, filters],
  );
  const { rows, total, isLoading, isError, refetch } =
    useListData<ConvertedLeadRow>(dataSource, listKey);

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

  const { prefs, setPrefs, visibleColumns } = useColumnPrefs(
    COLUMN_PREFS_MODULE,
    DETAILED_COLUMNS,
  );
  // Until the user arranges columns themselves, the default-hidden extras stay off.
  const displayColumns = useMemo(
    () =>
      prefs.order.length === 0 && prefs.hidden.length === 0
        ? visibleColumns.filter(
            (column) => !DEFAULT_HIDDEN_COLUMNS.includes(column.key),
          )
        : visibleColumns,
    [prefs, visibleColumns],
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
      <LeadFilterBuilder filter={advancedFilter} label="Converted Leads" />
      <ManageColumns
        columns={DETAILED_COLUMNS}
        prefs={prefs}
        onChange={setPrefs}
        triggerClassName={TOOLBAR_BUTTON_CLASS}
      />
    </div>
  );

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      toolbarActions={filterBar}
      trailingActions={<ReportMoreMenu reportSlug={slug} />}
      onExport={() => downloadConvertedLeadsExport(filters)}
      state={state}
      emptyTitle="No converted leads"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={refetch}
    >
      <div className="flex min-h-0 flex-col">
        <ResponsiveTableContainer label="Converted Leads">
          <Table<ConvertedLeadRow>
            columns={displayColumns}
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
          />
        </div>
      </div>
    </ReportShell>
  );
}
