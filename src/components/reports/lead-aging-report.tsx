"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  notFound,
  usePathname,
  useRouter,
  useSearchParams,
} from "next/navigation";
import {
  IconAlertCircle,
  IconAlertTriangle,
  IconClockOff,
  IconHourglassLow,
  IconSettings,
  IconShieldCheck,
  IconStatusChange,
  IconUser,
  IconUsers,
  type Icon,
} from "@tabler/icons-react";
import { findReport } from "./report-registry";
import { LeadAgingThresholdsDrawer } from "./lead-aging-thresholds-drawer";
import { ReportMoreMenu } from "./report-more-menu";
import { ReportToolbarSelect } from "./report-toolbar-select";
import { ReportShell, type ReportState } from "./report-shell";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Checkbox } from "@/components/ui/Checkbox";
import { Pagination } from "@/components/ui/Pagination";
import { Select } from "@/components/ui/Select";
import { Table } from "@/components/ui/Table";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { useListData, type ListDataSource } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import { useLookup } from "@/hooks/use-lookup";
import {
  fetchAgingThresholds,
  saveAgingThresholds,
} from "@/services/view-preferences-service";
import { cn } from "@/lib/cn";
import { formatAED, formatDate } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchLeadFilterOptions,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  AGING_PERIODS,
  DEFAULT_THRESHOLDS,
  downloadLeadAgingExport,
  fetchLeadAgingDetailed,
  fetchLeadAgingSummary,
  periodFrom,
  type AgingPeriodKey,
  type AgingThresholds,
  type LeadAgingAgentRow,
  type LeadAgingFilters,
  type LeadAgingLeadRow,
  type LeadAgingSummary,
  type LeadHealth,
} from "@/services/lead-aging-report-service";
import type { SortState, TableColumn } from "@/types";

/** The drill value the breakdown's "Unassigned" row filters the details table by. */
const UNASSIGNED = "unassigned";

/** Counts print with two decimals, exactly as the reference does ("6,908.00"). */
function formatCount(value: number): string {
  return value.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Day values print as "74.90d"; the average card uses one decimal ("51.4d"). */
function formatDays(value: number, digits = 2): string {
  return `${value.toFixed(digits)}d`;
}

/** One metric card: title, icon badge, value and its supporting label. */
function MetricCard({
  title,
  icon: Glyph,
  value,
  label,
  tone,
}: {
  title: string;
  icon: Icon;
  value: string;
  label: string;
  tone: { card: string; badge: string };
}) {
  return (
    <div
      className={cn(
        "flex min-w-56 flex-1 flex-col rounded-surface border p-4",
        tone.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-ink">{title}</span>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-8 shrink-0 items-center justify-center rounded-control text-white",
            tone.badge,
          )}
        >
          <Glyph size={18} stroke={1.75} />
        </span>
      </div>
      <p className="mt-3 text-2xl font-semibold text-ink">{value}</p>
      <p className="mt-1 text-xs text-ink-muted">{label}</p>
    </div>
  );
}

/** The reference's six card tints, in its order. Literal classes so Tailwind emits them. */
const CARD_TONES = {
  blue: { card: "border-blue-200 bg-blue-50", badge: "bg-blue-500" },
  red: { card: "border-red-200 bg-red-50", badge: "bg-red-500" },
  amber: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-500" },
  emerald: {
    card: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-500",
  },
  violet: { card: "border-violet-200 bg-violet-50", badge: "bg-violet-500" },
  orange: { card: "border-orange-200 bg-orange-50", badge: "bg-orange-500" },
} as const;

/** A band's pill in the breakdown table, and the details table's row tint. */
const BAND = {
  healthy: {
    pill: "bg-emerald-100 text-emerald-800",
    row: "bg-emerald-50/60",
    label: "Healthy",
    dot: "bg-emerald-500",
  },
  attention: {
    pill: "bg-amber-100 text-amber-800",
    row: "bg-amber-50/60",
    label: "Needs Attention",
    dot: "bg-amber-500",
  },
  stale: {
    pill: "bg-red-100 text-red-800",
    row: "bg-red-50/60",
    label: "Stale",
    dot: "bg-red-500",
  },
} as const satisfies Record<
  LeadHealth,
  { pill: string; row: string; label: string; dot: string }
>;

function BandCount({ value, band }: { value: number; band: LeadHealth }) {
  return (
    <span
      className={cn(
        "inline-flex min-w-14 justify-center rounded-full px-2 py-0.5 text-xs font-medium",
        BAND[band].pill,
      )}
    >
      {formatCount(value)}
    </span>
  );
}

function OwnerCell({ owners }: { owners: LeadAgingLeadRow["owner"] }) {
  if (owners.length === 0) {
    return (
      <span className="flex items-center" title="Unassigned">
        <Avatar name="Unassigned" size="sm" />
      </span>
    );
  }
  return (
    <div
      className="flex items-center gap-1"
      title={owners.map((owner) => owner.name).join(", ")}
    >
      {owners.slice(0, 3).map((owner) => (
        <Avatar key={owner.id} name={owner.name} size="sm" />
      ))}
      {owners.length > 3 && (
        <span className="text-xs text-ink-muted">+{owners.length - 3}</span>
      )}
    </div>
  );
}

/**
 * Lead Aging & Stale Leads (RPT-02.8). A single view, as the reference has it: the metric
 * cards, the per-agent breakdown and the lead details all read the one scoped query, so the
 * thresholds, filters and the closed-lost switch move every number on the page together.
 *
 * Ages and bands are computed by the server from the caller's thresholds — the browser
 * never re-buckets a row the server counted.
 */
export function LeadAgingReport({
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
        // Agent options are non-critical: the report still runs without them.
      });
    return () => controller.abort();
  }, []);
  const statuses = useLookup("leadStatus");

  // The bands are a per-user preference, served by the same store the Kanban pins use —
  // they follow the user, not the browser. The report runs on the defaults until it lands.
  const [thresholds, setThresholds] =
    useState<AgingThresholds>(DEFAULT_THRESHOLDS);
  useEffect(() => {
    const controller = new AbortController();
    fetchAgingThresholds(controller.signal)
      .then(setThresholds)
      .catch(() => {
        // Non-critical: the report still bands leads by the shipped defaults.
      });
    return () => controller.abort();
  }, []);
  const [configuring, setConfiguring] = useState(false);
  /** Bumped by Retry, so a failed summary is re-fetched with the same filters. */
  const [reloadNonce, setReloadNonce] = useState(0);

  const agentKey = params.get("agent") ?? "";
  const statusKey = params.get("status") ?? "";
  const periodKey = (params.get("period") ?? "all") as AgingPeriodKey;
  const includeLost = params.get("includeLost") === "true";
  const owner = params.get("owner") ?? "";

  const split = (value: string) =>
    value ? value.split(",").filter(Boolean) : [];
  const agentIds = useMemo(() => split(agentKey), [agentKey]);
  const statusValues = useMemo(() => split(statusKey), [statusKey]);

  /** The page-wide query: the cards and the breakdown read exactly this. */
  const filters: LeadAgingFilters = useMemo(
    () => ({
      ...thresholds,
      from: periodFrom(periodKey),
      agent: agentIds,
      status: statusValues,
      includeLost,
    }),
    [thresholds, periodKey, agentIds, statusValues, includeLost],
  );

  /** The details table adds the clicked agent row on top of the page-wide query. */
  /**
   * The details table adds the clicked agent row on top of the page-wide query — the
   * toolbar's own Sales Agent picks stay in force, so a row click narrows within the
   * current context instead of replacing it.
   */
  const detailFilters: LeadAgingFilters = useMemo(
    () =>
      owner === ""
        ? filters
        : owner === UNASSIGNED
          ? { ...filters, unassigned: true }
          : { ...filters, owner },
    [filters, owner],
  );

  // The summary result carries the filters it answered, so a stale response can never be
  // read as current — the same rule `useListData` applies to its pages.
  const filterKey = useMemo(() => JSON.stringify(filters), [filters]);
  const [result, setResult] = useState<{
    key: string;
    data: LeadAgingSummary | null;
    error: boolean;
  }>({ key: "", data: null, error: false });

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadAgingSummary(filters, controller.signal)
      .then((data) => setResult({ key: filterKey, data, error: false }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setResult({ key: filterKey, data: null, error: true });
      });
    return () => controller.abort();
  }, [filters, filterKey, reloadNonce]);

  // The last good summary stays on screen while the next one loads, so changing a filter
  // never blanks the thresholds bar, the cards or the tables — only the numbers go quiet.
  const summary = result.data;
  const isRefreshing = result.key !== filterKey;
  const summaryError = result.key === filterKey && result.error;

  const dataSource: ListDataSource<LeadAgingLeadRow> = useCallback(
    (listQuery, signal) =>
      fetchLeadAgingDetailed(
        listQuery.page,
        listQuery.size,
        detailFilters,
        listQuery.sort,
        signal,
      ),
    [detailFilters],
  );
  const listKey = useMemo(
    () => ({ ...query, activeFilters: detailFilters }),
    [query, detailFilters],
  );
  const {
    rows,
    total,
    isLoading: detailsLoading,
    isError: detailsError,
    refetch,
  } = useListData<LeadAgingLeadRow>(dataSource, listKey);

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

  // The breakdown answers with every agent at once, so its footer pages rows already in
  // hand — display paging, never a second source of truth.
  const [agentPage, setAgentPage] = useState(1);
  const [agentSize, setAgentSize] = useState(100);
  // Memoised so the sort below (and its page slice) are not rebuilt on every render by a
  // fresh array literal.
  const agents = useMemo(() => summary?.agents ?? [], [summary]);

  /**
   * The breakdown's own sort. Its rows all arrive in one response, so ordering them here
   * is the whole job — no refetch, and the server's default (oldest book of business
   * first) stands until a header is clicked.
   */
  const [agentSort, setAgentSort] = useState<SortState | undefined>(undefined);

  const sortedAgents = useMemo(() => {
    if (!agentSort) return agents;
    const value = (row: LeadAgingAgentRow): number | null =>
      agentSort.key === "avgLeadAge"
        ? row.avgLeadAgeDays
        : agentSort.key === "avgAssignment"
          ? row.avgAgeSinceAssignmentDays
          : agentSort.key === "avgNoActivity"
            ? row.avgDaysSinceActivityDays
            : row.noActivityEver;
    const sign = agentSort.direction === "asc" ? 1 : -1;
    return [...agents].sort((a, b) => {
      const left = value(a);
      const right = value(b);
      // An agent with no assignment date has nothing to compare — park those last in
      // both directions rather than letting a null read as zero.
      if (left === null || right === null) {
        return left === right ? 0 : left === null ? 1 : -1;
      }
      return (left - right) * sign || a.agentName.localeCompare(b.agentName);
    });
  }, [agents, agentSort]);

  const agentPageCount = Math.max(1, Math.ceil(agents.length / agentSize));
  const agentVisible = sortedAgents.slice(
    (Math.min(agentPage, agentPageCount) - 1) * agentSize,
    Math.min(agentPage, agentPageCount) * agentSize,
  );

  const selectAgent = useCallback(
    (row: LeadAgingAgentRow) => {
      const value = row.agentId ?? UNASSIGNED;
      setParams({ owner: owner === value ? null : value });
      resetPage();
    },
    [owner, setParams, resetPage],
  );

  const agentColumns: readonly TableColumn<LeadAgingAgentRow>[] = useMemo(
    () => [
      {
        key: "agent",
        header: "Agent",
        // The selected agent carries a small green dot, as the reference shows. An
        // invisible placeholder holds the same space on every other row, so picking one
        // never shifts the column's names sideways.
        render: (row) => {
          const selected = (row.agentId ?? UNASSIGNED) === owner;
          return (
            <span className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={cn(
                  "size-1.5 shrink-0 rounded-full",
                  selected ? "bg-emerald-500" : "bg-transparent",
                )}
              />
              {row.agentName}
            </span>
          );
        },
      },
      {
        key: "green",
        header: `Green (0–${thresholds.green}d)`,
        align: "center",
        headerClassName: "bg-emerald-50/70",
        render: (row) => <BandCount value={row.green} band="healthy" />,
      },
      {
        key: "amber",
        header: `Amber (${thresholds.green + 1}–${thresholds.amber}d)`,
        align: "center",
        headerClassName: "bg-amber-50/70",
        render: (row) => <BandCount value={row.amber} band="attention" />,
      },
      {
        key: "red",
        header: `Red (${thresholds.amber + 1}+d)`,
        align: "center",
        headerClassName: "bg-red-50/70",
        render: (row) => <BandCount value={row.red} band="stale" />,
      },
      {
        key: "total",
        header: "Total Leads",
        align: "right",
        render: (row) => (
          <span className="font-semibold text-ink">
            {formatCount(row.total)}
          </span>
        ),
      },
      {
        key: "avgLeadAge",
        sortable: true,
        header: "Avg Lead Age",
        align: "right",
        render: (row) => formatDays(row.avgLeadAgeDays),
      },
      {
        key: "avgAssignment",
        sortable: true,
        header: "Avg Age / Assignment",
        align: "right",
        render: (row) =>
          row.avgAgeSinceAssignmentDays === null ? (
            <span className="text-ink-subtle">—</span>
          ) : (
            formatDays(row.avgAgeSinceAssignmentDays)
          ),
      },
      {
        key: "avgNoActivity",
        sortable: true,
        header: "Avg Days / No Activity",
        align: "right",
        render: (row) => formatDays(row.avgDaysSinceActivityDays),
      },
      {
        key: "noActivityEver",
        sortable: true,
        header: "No Activity Ever",
        align: "right",
        render: (row) => formatCount(row.noActivityEver),
      },
    ],
    [thresholds, owner],
  );

  const detailColumns: readonly TableColumn<LeadAgingLeadRow>[] = useMemo(
    () => [
      {
        key: "name",
        sortable: true,
        header: "Lead Name",
        render: (row) => (
          <CustomerNameLink
            leadId={row.id}
            name={row.name}
            from="lead-aging"
            newTab
          />
        ),
      },
      {
        key: "owner",
        sortable: true,
        header: "Owner",
        render: (row) => <OwnerCell owners={row.owner} />,
      },
      {
        key: "stage",
        sortable: true,
        header: "Stage",
        render: (row) => (
          <span
            className={cn(
              "inline-flex max-w-full items-center truncate rounded-full px-2.5 py-0.5 text-xs font-medium",
              stageColorClasses(row.stageColor).badge,
            )}
          >
            {row.stage}
          </span>
        ),
      },
      {
        key: "source",
        sortable: true,
        header: "Source",
        render: (row) =>
          row.source ?? <span className="text-ink-subtle">—</span>,
      },
      {
        key: "leadAge",
        sortable: true,
        header: "Lead Age (D)",
        subheader: "Since Created",
        align: "right",
        render: (row) => formatDays(row.leadAgeDays),
      },
      {
        key: "ageAssignment",
        sortable: true,
        header: "Age / Assignment (D)",
        subheader: "Since Assigned",
        align: "right",
        render: (row) =>
          row.ageSinceAssignmentDays === null ? (
            <span className="text-ink-subtle">—</span>
          ) : (
            formatDays(row.ageSinceAssignmentDays)
          ),
      },
      {
        key: "daysSinceNoActivity",
        sortable: true,
        header: "Days Since No Activity",
        align: "right",
        render: (row) => formatDays(row.daysSinceNoActivity),
      },
      {
        key: "lastActivity",
        sortable: true,
        header: "Last Activity",
        render: (row) =>
          row.lastActivityAt ? (
            formatDate(row.lastActivityAt)
          ) : (
            <span className="text-ink-muted">Never</span>
          ),
      },
      {
        key: "amount",
        sortable: true,
        header: "Amount",
        align: "right",
        render: (row) => formatAED(row.amount),
      },
      {
        key: "status",
        sortable: true,
        header: "Status",
        render: (row) => (
          <span
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
              BAND[row.health].pill,
            )}
          >
            <span
              aria-hidden="true"
              className={cn("size-1.5 rounded-full", BAND[row.health].dot)}
            />
            {BAND[row.health].label}
          </span>
        ),
      },
    ],
    [],
  );

  if (!resolved) notFound();

  // Only the very first load (or a failure with nothing to show) takes over the page. Once
  // there is data the body stays mounted — an empty result shows zeroed cards and empty
  // tables with every control still reachable.
  const state: ReportState =
    summary === null ? (summaryError ? "error" : "loading") : "ready";

  const kpis = summary?.kpis;
  const redFrom = thresholds.amber + 1;

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
        label="Lead Status"
        icon={IconStatusChange}
        multiple
        searchable
        value={statusValues}
        onChange={(value) => {
          setParams({ status: value.length ? value.join(",") : null });
          resetPage();
        }}
        options={statuses.options.map((option) => ({
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
      toolbarActions={filterBar}
      trailingActions={<ReportMoreMenu reportSlug={slug} />}
      onExport={() => downloadLeadAgingExport(detailFilters)}
      state={state}
      emptyTitle="No leads to age"
      emptyDescription="No leads match the selected filters."
      errorMessage="The report couldn’t be loaded. Please try again."
      onRetry={() => {
        setReloadNonce((value) => value + 1);
        refetch();
      }}
    >
      <div className="flex flex-col gap-4">
        {/* Thresholds bar */}
        <Card className="flex flex-wrap items-center justify-end gap-3 p-4">
          <span className="text-xs font-medium tracking-wide text-ink-muted uppercase">
            Current thresholds:
          </span>
          <span className="rounded-full bg-canvas px-3 py-1.5 text-sm text-ink">
            Green ≤{thresholds.green}d · Amber ≤{thresholds.amber}d · Red ≥
            {redFrom}d
          </span>
          <Button variant="secondary" onClick={() => setConfiguring(true)}>
            <IconSettings size={18} stroke={1.75} aria-hidden="true" />
            Configure Thresholds
          </Button>
        </Card>

        {/* Metric cards — dimmed, not unmounted, while the next summary loads. */}
        {kpis && (
          <div
            aria-busy={isRefreshing}
            className={cn(
              "scrollbar-slim flex gap-4 overflow-x-auto pb-1 transition-opacity duration-(--duration-shell) ease-shell",
              isRefreshing && "opacity-60",
            )}
          >
            <MetricCard
              title="Total Leads Tracked"
              icon={IconUsers}
              tone={CARD_TONES.blue}
              value={formatCount(kpis.totalTracked)}
              label={includeLost ? "Incl. closed lost" : "Active Leads"}
            />
            <MetricCard
              title="Stale / Critical"
              icon={IconAlertCircle}
              tone={CARD_TONES.red}
              value={formatCount(kpis.stale)}
              label={`Age ≥${redFrom} days`}
            />
            <MetricCard
              title="Needs Attention"
              icon={IconAlertTriangle}
              tone={CARD_TONES.amber}
              value={formatCount(kpis.needsAttention)}
              label={`Leads ${thresholds.green + 1}–${thresholds.amber} days old`}
            />
            <MetricCard
              title="Healthy"
              icon={IconShieldCheck}
              tone={CARD_TONES.emerald}
              value={formatCount(kpis.healthy)}
              label={`Age 0–${thresholds.green} days`}
            />
            <MetricCard
              title="Avg Lead Age"
              icon={IconHourglassLow}
              tone={CARD_TONES.violet}
              value={formatDays(kpis.avgLeadAgeDays, 1)}
              label="Days across all tracked leads"
            />
            <MetricCard
              title="No Activity Ever"
              icon={IconClockOff}
              tone={CARD_TONES.orange}
              value={formatCount(kpis.noActivityEver)}
              label="Leads with zero activity"
            />
          </div>
        )}

        {/* Include closed-lost */}
        <label className="flex items-center justify-end gap-2 text-sm text-ink">
          <Checkbox
            checked={includeLost}
            onChange={(event) => {
              setParams({ includeLost: event.target.checked ? "true" : null });
              resetPage();
            }}
          />
          Include Closed Lost Leads
        </label>

        {/* Agent aging breakdown */}
        <Card className="flex min-w-0 flex-col overflow-hidden">
          {/* The reference sits the period select opposite the heading, centred against the
              two-line block and flush with the card's right padding. */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <div className="min-w-0">
              <h2 className="text-base font-semibold text-ink">
                Agent Aging Breakdown
              </h2>
              <p className="mt-0.5 text-sm text-ink-muted">
                Click an agent row to filter the details table below
              </p>
            </div>
            <Select
              aria-label="Breakdown period"
              className="w-48 shrink-0"
              value={periodKey}
              onChange={(event) => {
                setParams({
                  period:
                    event.target.value === "all" ? null : event.target.value,
                });
                setAgentPage(1);
                resetPage();
              }}
              options={AGING_PERIODS.map((period) => ({
                value: period.key,
                label: period.label,
              }))}
            />
          </div>

          <ResponsiveTableContainer
            label="Agent Aging Breakdown"
            // A bounded height turns the container into the rows' scroll region: they scroll
            // under the sticky header, above the pagination, instead of growing the page.
            className="max-h-96"
          >
            <Table<LeadAgingAgentRow>
              columns={agentColumns}
              rows={agentVisible}
              getRowId={(row) => row.agentId ?? UNASSIGNED}
              emptyState={
                <EmptyState
                  icon={IconUsers}
                  title="No agents to show"
                  description="No leads match the selected filters."
                />
              }
              sort={agentSort}
              onSortChange={(next) => {
                setAgentSort(next);
                setAgentPage(1);
              }}
              sortTooltips
              onRowClick={selectAgent}
              // The selected row stays tinted while it filters the details table below.
              rowClassName={(row) =>
                (row.agentId ?? UNASSIGNED) === owner
                  ? "bg-emerald-50 hover:bg-emerald-50"
                  : undefined
              }
            />
          </ResponsiveTableContainer>

          <div className="border-t border-hairline p-4">
            <Pagination
              page={Math.min(agentPage, agentPageCount)}
              pageCount={agentPageCount}
              total={agents.length}
              pageSize={agentSize}
              onPageChange={setAgentPage}
              onPageSizeChange={(next) => {
                setAgentSize(next);
                setAgentPage(1);
              }}
            />
          </div>
        </Card>

        {/* Lead aging details */}
        <Card className="flex min-w-0 flex-col overflow-hidden">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4">
            <h2 className="text-base font-semibold text-ink">
              Lead Aging Details
            </h2>
            {owner !== "" && (
              <Button
                variant="ghost"
                onClick={() => setParams({ owner: null })}
              >
                Clear agent filter
              </Button>
            )}
          </div>

          <ResponsiveTableContainer
            label="Lead Aging Details"
            // A bounded height turns the container into the rows' scroll region: they scroll
            // under the sticky header, above the pagination, instead of growing the page.
            className="max-h-96"
          >
            <Table<LeadAgingLeadRow>
              columns={detailColumns}
              rows={rows}
              getRowId={(row) => row.id}
              sort={sort}
              onSortChange={setSort}
              sortTooltips
              isLoading={detailsLoading}
              errorState={
                detailsError ? (
                  <ErrorState
                    title="Couldn’t load the lead details"
                    description="Something went wrong while loading these leads. Check your connection and try again."
                    onRetry={refetch}
                  />
                ) : undefined
              }
              emptyState={
                <EmptyState
                  icon={IconHourglassLow}
                  title="No leads to age"
                  description="No leads match the selected filters."
                />
              }
              rowClassName={(row) => BAND[row.health].row}
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
        <LeadAgingThresholdsDrawer
          open
          value={thresholds}
          onClose={() => setConfiguring(false)}
          onSave={async (next: AgingThresholds) => {
            const saved = await saveAgingThresholds(next);
            setThresholds(saved);
            setConfiguring(false);
            setAgentPage(1);
            resetPage();
          }}
        />
      )}
    </ReportShell>
  );
}
