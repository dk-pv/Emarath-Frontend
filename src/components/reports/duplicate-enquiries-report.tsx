"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import { IconFileSearch, IconTag, IconUser } from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { ReportDateFilter } from "./report-date-filter";
import { ReportMetricCard, type CardTone } from "./report-metric-card";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportShell, type ReportState } from "./report-shell";
import { Avatar } from "@/components/ui/Avatar";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
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
  DUPLICATE_THRESHOLDS,
  fetchDuplicateEnquiries,
  fetchDuplicateEnquiriesSummary,
  type DuplicateEnquiriesFilters,
  type DuplicateEnquiriesKpis,
  type DuplicateEnquiryRow,
} from "@/services/duplicate-enquiries-report-service";
import type { TableColumn } from "@/types";

/** One tint per card, in the reference's left-to-right order. */
const CARD_TONES: readonly CardTone[] = [
  "orange",
  "blue",
  "violet",
  "emerald",
  "yellow",
];

/** The Leads list, showing every enquiry that shares one phone number. */
function leadsHref(primaryPhone: string): string {
  const conditions = [
    { field: "primaryPhone", operator: "is", values: [primaryPhone] },
  ];
  return `/leads?conditions=${encodeURIComponent(JSON.stringify(conditions))}`;
}

/** A muted em dash, so an empty cell never reads as a layout gap. */
function Dash() {
  return <span className="text-ink-subtle">—</span>;
}

function AssignedCell({
  agents,
}: {
  agents: DuplicateEnquiryRow["assignedTo"];
}) {
  if (agents.length === 0) return <Dash />;
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

const COLUMNS: readonly TableColumn<DuplicateEnquiryRow>[] = [
  { key: "name", header: "Name", render: (row) => row.name },
  {
    key: "primaryPhone",
    header: "Primary Phone",
    render: (row) => row.primaryPhone,
  },
  {
    key: "secondaryPhone",
    header: "Secondary Phone",
    render: (row) => row.secondaryPhone ?? <Dash />,
  },
  {
    key: "primaryEmail",
    header: "Primary Email",
    render: (row) => row.primaryEmail ?? <Dash />,
  },
  {
    // `Lead` carries one email address, so this reads empty until the model grows a second.
    key: "secondaryEmail",
    header: "Secondary Email",
    render: (row) => row.secondaryEmail ?? <Dash />,
  },
  {
    // The count opens the Leads list showing exactly this group's enquiries — the only
    // way from a group back to the leads it is about.
    key: "duplicateCount",
    header: "Duplicate Count",
    align: "right",
    render: (row) => (
      <Link
        href={leadsHref(row.primaryPhone)}
        target="_blank"
        rel="noopener"
        aria-label={`Open the ${row.duplicateCount} enquiries on ${row.primaryPhone} in a new tab`}
        className="focus-ring rounded-sm font-semibold text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
      >
        {row.duplicateCount.toLocaleString("en-US")}
      </Link>
    ),
  },
  {
    key: "latestEnquiryAt",
    header: "Latest Enquiry",
    render: (row) => formatDateTime(row.latestEnquiryAt),
  },
  {
    key: "assigned",
    header: "Assigned",
    render: (row) => <AssignedCell agents={row.assignedTo} />,
  },
  {
    key: "sources",
    header: "Sources",
    render: (row) =>
      row.sources.length === 0 ? (
        <Dash />
      ) : (
        <span className="flex flex-wrap gap-1">
          {row.sources.map((source) => (
            <span
              key={source}
              className="inline-flex max-w-full items-center truncate rounded-control bg-canvas px-2 py-0.5 text-xs font-medium text-ink"
            >
              {source}
            </span>
          ))}
        </span>
      ),
  },
];

/**
 * Duplicate Enquiries (RPT-02.10). A single view, as the reference has it: five threshold
 * cards over a table of duplicate groups.
 *
 * A duplicate is a lead whose primary phone another lead also holds — the same rule the
 * Leads list's "Duplicate Lead" search scope uses, so the two can never disagree. The
 * filters define the population duplicates are judged within, so By Date, Assigned To and
 * Source genuinely change which groups the report finds.
 */
export function DuplicateEnquiriesReport({
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
  const sources = useLookup("sources");

  const periodParam = params.get("period");
  const periodKey = isDatePeriodKey(periodParam) ? periodParam : null;
  const customFrom = params.get("from") ?? undefined;
  const customTo = params.get("to") ?? undefined;
  const agentKey = params.get("agent") ?? "";
  const sourceKey = params.get("source") ?? "";

  const split = (value: string) =>
    value ? value.split(",").filter(Boolean) : [];
  const agentIds = useMemo(() => split(agentKey), [agentKey]);
  const sourceValues = useMemo(() => split(sourceKey), [sourceKey]);

  const filters: DuplicateEnquiriesFilters = useMemo(
    () => ({
      ...(periodKey
        ? periodRange(periodKey, { from: customFrom, to: customTo })
        : {}),
      agent: agentIds,
      source: sourceValues,
    }),
    [periodKey, customFrom, customTo, agentIds, sourceValues],
  );

  // The last good summary stays on screen while the next loads, so changing a filter
  // never blanks the cards — only the numbers go quiet.
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const [result, setResult] = useState<{
    key: string;
    data: DuplicateEnquiriesKpis | null;
    error: boolean;
  }>({ key: "", data: null, error: false });
  const [reloadNonce, setReloadNonce] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    fetchDuplicateEnquiriesSummary(filters, controller.signal)
      .then((data) =>
        setResult({ key: filterKey, data: data.kpis, error: false }),
      )
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setResult({ key: filterKey, data: null, error: true });
      });
    return () => controller.abort();
  }, [filters, filterKey, reloadNonce]);

  const kpis = result.data;
  const isRefreshing = result.key !== filterKey;
  const summaryError = result.key === filterKey && result.error;

  const dataSource: ListDataSource<DuplicateEnquiryRow> = useCallback(
    (listQuery, signal) =>
      fetchDuplicateEnquiries(listQuery.page, listQuery.size, filters, signal),
    [filters],
  );
  const listKey = useMemo(
    () => ({ ...query, activeFilters: filters }),
    [query, filters],
  );
  const {
    rows,
    total,
    isLoading,
    isError: rowsError,
    refetch,
  } = useListData<DuplicateEnquiryRow>(dataSource, listKey);

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

  // Only the very first load (or a failure with nothing to show) takes over the page: an
  // empty result keeps the cards and the toolbar reachable, as the reference does.
  const state: ReportState =
    kpis === null ? (summaryError ? "error" : "loading") : "ready";

  const filterBar = (
    <div className="flex flex-wrap items-center gap-1 empty:hidden">
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
      <ReportToolbarSelect
        label="Assigned To"
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
        label="Source"
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
    </div>
  );

  return (
    <ReportShell
      report={resolved.report}
      category={resolved.category}
      bare
      hideExport
      trailingActions={<ReportMoreMenu reportSlug={resolved.report.slug} />}
      toolbarActions={filterBar}
      state={state}
      emptyTitle="No duplicate enquiries"
      emptyDescription="No leads share a phone number for the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={() => {
        setReloadNonce((value) => value + 1);
        refetch();
      }}
    >
      <div className="flex flex-col gap-4">
        {kpis && (
          <div
            aria-busy={isRefreshing}
            className={cn(
              "scrollbar-slim flex gap-4 overflow-x-auto pb-1 transition-opacity duration-(--duration-shell) ease-shell",
              isRefreshing && "opacity-60",
            )}
          >
            {DUPLICATE_THRESHOLDS.map((threshold, index) => (
              <ReportMetricCard
                key={threshold}
                title={`Leads with ${threshold}+ duplicate`}
                icon={IconFileSearch}
                badgeShape="circle"
                tone={CARD_TONES[index % CARD_TONES.length]}
                value={(
                  kpis.leadsWithAtLeast[String(threshold)] ?? 0
                ).toLocaleString("en-US")}
              />
            ))}
          </div>
        )}

        <Card className="flex min-w-0 flex-col overflow-hidden">
          <ResponsiveTableContainer
            label="Duplicate Enquiries"
            className="max-h-[32rem]"
          >
            <Table<DuplicateEnquiryRow>
              columns={COLUMNS}
              rows={rows}
              getRowId={(row) => row.id}
              isLoading={isLoading}
              errorState={
                rowsError ? (
                  <ErrorState
                    title="Couldn’t load the duplicate enquiries"
                    description="Something went wrong while loading these leads. Check your connection and try again."
                    onRetry={refetch}
                  />
                ) : undefined
              }
              emptyState={
                <EmptyState
                  icon={IconFileSearch}
                  title="No data yet"
                  description="No leads share a phone number for the selected filters."
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
    </ReportShell>
  );
}
