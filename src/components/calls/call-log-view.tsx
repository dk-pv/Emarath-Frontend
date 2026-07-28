"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconPhoneIncoming,
  IconPhoneOutgoing,
  IconPhonePlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Pagination } from "@/components/ui/Pagination";
import { SearchInput } from "@/components/ui/SearchInput";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Table } from "@/components/ui/Table";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { ManageColumns } from "@/components/table/manage-columns";
import { FilterPanel } from "@/components/filters/filter-panel";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LeadStatusBadge } from "@/components/leads/lead-status-badge";
import { fetchAssignableAgents } from "@/services/lookups-service";
import { useStages } from "@/components/stages/stages-context";
import { useColumnPrefs } from "@/hooks/use-column-prefs";
import { useFilters } from "@/hooks/use-filters";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { cn } from "@/lib/cn";
import type { FilterField, TableColumn } from "@/types";
import type { LeadListItem } from "@/services/leads-service";
import {
  fetchCallLog,
  type CallLogResponse,
  type CallLogRow,
  type CallOutcome,
} from "@/services/calls-service";
import { rangeFor, type PeriodId } from "./call-period-filter";

/** The quick outcome tabs (CALL-06.1 AC1); All clears the outcome filter. */
const OUTCOME_TABS: { label: string; value: CallOutcome | null }[] = [
  { label: "All", value: null },
  { label: "Answered", value: "ANSWERED" },
  { label: "No Answer", value: "NO_ANSWER" },
  { label: "Busy", value: "BUSY" },
];

const OUTCOME: Record<CallOutcome, { label: string; className: string }> = {
  ANSWERED: { label: "ANSWERED", className: "text-ink" },
  NO_ANSWER: { label: "NO ANSWER", className: "text-danger" },
  BUSY: { label: "BUSY", className: "text-warning" },
};

function orDash(value: string | null) {
  return value ? value : <span className="text-ink-subtle">--</span>;
}

/** "26-07-2026, 11:30:35 PM" — the Workpex call timestamp. */
function formatDateTime(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return {
    date: `${dd}-${mm}-${d.getFullYear()}`,
    time: d.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    }),
  };
}

const DAY_MS = 24 * 60 * 60 * 1000;

/** Local start-of-day for a picked date (the DatePicker stores an ISO instant). */
function dayStart(iso: string): Date {
  const d = new Date(iso);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The log's [from, to) window: the popup Date Range when either bound is set
 * (inclusive of the "to" day), otherwise the dashboard period. `to` is exclusive
 * to match the backend's `startedAt < end`.
 */
function resolveRange(
  period: PeriodId,
  dateFrom: string | undefined,
  dateTo: string | undefined,
): { from: string; to: string } {
  if (!dateFrom && !dateTo) return rangeFor(period);
  const base = rangeFor(period);
  return {
    from: dateFrom ? dayStart(dateFrom).toISOString() : base.from,
    to: dateTo
      ? new Date(dayStart(dateTo).getTime() + DAY_MS).toISOString()
      : base.to,
  };
}

const COLUMNS: TableColumn<CallLogRow>[] = [
  {
    key: "leadName",
    header: "Lead Name",
    render: (row) => (
      // Direction indicator (AC2) + the drill-through link to the lead (AC4).
      <span className="flex items-center gap-2">
        {row.direction === "INBOUND" ? (
          <IconPhoneIncoming
            size={16}
            stroke={1.75}
            className="shrink-0 text-ink-subtle"
            aria-label="Inbound"
          />
        ) : (
          <IconPhoneOutgoing
            size={16}
            stroke={1.75}
            className="shrink-0 text-ink-subtle"
            aria-label="Outbound"
          />
        )}
        <CustomerNameLink leadId={row.leadId} name={row.leadName} />
      </span>
    ),
  },
  {
    key: "phone",
    header: "Phone",
    render: (row) => <span className="text-ink">{row.phone}</span>,
  },
  {
    key: "dateTime",
    header: "Date & Time",
    render: (row) => {
      const { date, time } = formatDateTime(row.startedAt);
      return (
        <span className="flex flex-col">
          <span className="text-ink">{date}</span>
          <span className="text-xs text-ink-muted">{time}</span>
        </span>
      );
    },
  },
  {
    key: "outcome",
    header: "Call Outcome",
    render: (row) => (
      <span className={cn("font-medium", OUTCOME[row.outcome].className)}>
        {OUTCOME[row.outcome].label}
      </span>
    ),
  },
  {
    key: "leadStatus",
    header: "Lead Status",
    // LeadStatusBadge reads only `.status` here (no LeadStatusProvider → a plain
    // pill); the log row carries just the status string.
    render: (row) => (
      <LeadStatusBadge lead={{ status: row.leadStatus } as LeadListItem} />
    ),
  },
  {
    key: "nextFollowUp",
    header: "Next Follow-up",
    render: (row) =>
      row.nextFollowUp ? (
        (() => {
          const { date, time } = formatDateTime(row.nextFollowUp);
          return (
            <span className="flex flex-col">
              <span className="text-ink">{date}</span>
              <span className="text-xs text-ink-muted">{time}</span>
            </span>
          );
        })()
      ) : (
        <span className="text-ink-subtle">--</span>
      ),
  },
  {
    key: "leadNotes",
    header: "Lead Notes",
    render: (row) => orDash(row.leadNotes),
  },
  {
    key: "callNotes",
    header: "Call Notes",
    render: (row) => orDash(row.callNotes),
  },
];

/**
 * The Recent Call Log (CALL-05.2): the scoped, paginated table behind the KPIs.
 * Consumes GET /api/calls/log for the period the parent's Filter selects — the
 * parent remounts this via `key={period}`, so the page resets to 1 on a period
 * change. Reuses the shared Table, Pagination, Manage Columns (client-side
 * visibility) and the tagged-fetch/retry pattern.
 *
 * The outcome tabs, search and advanced filters are CALL-06.1; Audio Clip, the
 * row Actions, and the Date & Time agent avatar are deferred (Change Request /
 * not in the CALL-05.1 API).
 */
export function CallLog({ period }: { period: PeriodId }) {
  const [page, setPage] = useState(1);
  const [outcome, setOutcome] = useState<CallOutcome | null>(null);
  const [searchInput, setSearchInput] = useState("");
  const debouncedSearch = useDebouncedValue(searchInput.trim(), 300);
  const [loaded, setLoaded] = useState<{
    key: string;
    data: CallLogResponse;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const { prefs, setPrefs, visibleColumns } = useColumnPrefs("calls", COLUMNS);

  // Agent + Date Range + Lead Status (CALL-06.1 AC3) run through the shared
  // filter framework. Agents reuse the assignable-agents source; the dropdown
  // stays empty (and the log still loads) if that call fails.
  const [agents, setAgents] = useState<{ id: string; name: string }[]>([]);
  useEffect(() => {
    const controller = new AbortController();
    fetchAssignableAgents(controller.signal)
      .then(setAgents)
      .catch(() => {});
    return () => controller.abort();
  }, []);

  const { stages } = useStages();
  const fields = useMemo<FilterField[]>(
    () => [
      {
        key: "agentId",
        label: "Agent",
        type: "select",
        options: agents.map((agent) => ({
          label: agent.name,
          value: agent.id,
        })),
      },
      { key: "dateFrom", label: "Date From", type: "date" },
      { key: "dateTo", label: "Date To", type: "date" },
      {
        key: "leadStatus",
        label: "Lead Status",
        type: "select",
        options: stages.map((stage) => ({
          label: stage.name,
          value: stage.name,
        })),
      },
    ],
    [agents, stages],
  );
  const filters = useFilters(fields);

  const asString = (value: unknown): string | undefined =>
    typeof value === "string" && value ? value : undefined;
  const agentId = asString(filters.valueOf("agentId"));
  const leadStatus = asString(filters.valueOf("leadStatus"));
  const dateFrom = asString(filters.valueOf("dateFrom"));
  const dateTo = asString(filters.valueOf("dateTo"));
  const range = useMemo(
    () => resolveRange(period, dateFrom, dateTo),
    [period, dateFrom, dateTo],
  );

  // One key per (page + all filters); a result only counts for the current
  // combination, so a slow earlier response can't repaint a newer one.
  const requestKey = `${page}|${outcome ?? ""}|${debouncedSearch}|${agentId ?? ""}|${range.from}|${range.to}|${leadStatus ?? ""}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallLog(
      range,
      page,
      {
        outcome: outcome ?? undefined,
        search: debouncedSearch || undefined,
        leadStatus,
        agentId,
      },
      controller.signal,
    )
      .then((data) => {
        if (!active) return;
        setLoaded({ key: requestKey, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(requestKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [page, outcome, debouncedSearch, agentId, range, leadStatus, requestKey, reloadToken]);

  const data = loaded?.key === requestKey ? loaded.data : null;
  const isError = failed === requestKey;
  const isLoading = !data && !isError;
  const pageCount = data ? Math.max(1, Math.ceil(data.total / data.size)) : 1;
  const anyActive =
    outcome !== null || searchInput.trim() !== "" || filters.activeCount > 0;

  const clearAll = () => {
    setOutcome(null);
    setSearchInput("");
    filters.clearAll();
    setPage(1);
  };

  return (
    <section className="rounded-surface border border-hairline bg-surface">
      <SectionHeader title="Recent Call Log" />

      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-2">
        {/* Outcome tabs (AC1) — All clears the outcome. */}
        <div className="flex items-center gap-1">
          {OUTCOME_TABS.map((tab) => {
            const activeTab = outcome === tab.value;
            return (
              <button
                key={tab.label}
                type="button"
                aria-pressed={activeTab}
                onClick={() => {
                  setOutcome(tab.value);
                  setPage(1);
                }}
                className={cn(
                  "focus-ring h-control-sm rounded-full px-3 text-sm font-medium transition-colors duration-(--duration-shell) ease-shell",
                  activeTab
                    ? "bg-brand text-ink"
                    : "text-ink-muted hover:bg-canvas hover:text-ink",
                )}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <SearchInput
            value={searchInput}
            onChange={(event) => {
              setSearchInput(event.target.value);
              setPage(1);
            }}
            placeholder="Search by Name or Phone"
            aria-label="Search by name or phone"
            className="w-64 max-w-full"
          />
          <ManageColumns columns={COLUMNS} prefs={prefs} onChange={setPrefs} />
          <FilterPanel
            fields={fields}
            activeCount={filters.activeCount}
            valueOf={filters.valueOf}
            onChange={(key, value) => {
              filters.setCondition(key, value);
              setPage(1);
            }}
            onClear={() => {
              filters.clearAll();
              setPage(1);
            }}
          />
          {anyActive && (
            <Button variant="ghost" size="sm" onClick={clearAll}>
              Clear
            </Button>
          )}
        </div>
      </div>

      {isError ? (
        <div className="p-4">
          <ErrorState
            title="Couldn’t load the call log"
            description="Something went wrong loading recent calls. Check your connection and try again."
            onRetry={() => {
              setFailed(null);
              setReloadToken((token) => token + 1);
            }}
          />
        </div>
      ) : (
        <ResponsiveTableContainer label="Recent call log">
          <Table
            columns={visibleColumns}
            rows={data?.rows ?? []}
            getRowId={(row) => row.id}
            isLoading={isLoading}
            emptyState={
              <EmptyState
                icon={IconPhonePlus}
                title="No records yet"
                description={
                  anyActive
                    ? "No calls match your search or filters."
                    : "Calls for this period will appear here once they are logged."
                }
              />
            }
          />
        </ResponsiveTableContainer>
      )}

      {data && pageCount > 1 && (
        <div className="border-t border-hairline px-4 py-3">
          <Pagination
            page={page}
            pageCount={pageCount}
            total={data.total}
            onPageChange={setPage}
          />
        </div>
      )}
    </section>
  );
}
