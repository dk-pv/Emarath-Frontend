import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { LeadListItem } from "@/services/leads-service";
import type { ListResult } from "@/types";

/**
 * One lead in the detailed view (RPT-02.3), mirroring the backend `LeadsByStatusLeadRow`:
 * the Leads list's own row — so the report's columns are the list's, fed by the same
 * mapping — plus the status's stage colour KEY (`violet`, `amber`, …) or null, mapped to
 * tokens via stage-palette.
 */
export type LeadsByStatusLeadRow = LeadListItem & {
  statusColor: string | null;
};

/** One breakdown row: lead count at a status + its stage colour key, mirroring `StatusCountRow`. */
export interface StatusCountRow {
  status: string;
  count: number;
  color: string | null;
}

/** The report's filters (RPT-02.3 AC3). */
export interface LeadsByStatusFilters {
  /** The date window's bounds — ISO instants from `periodRange`, half-open [from, to). */
  from?: string;
  to?: string;
  /** Which lead date the window applies to; the server defaults to creation. */
  dateField?: LeadsByStatusDateField;
  team?: string[];
  /** Assigned-agent user ids (toolbar "Sales Agent"). */
  agent?: string[];
  /** Lead status names (toolbar "Lead Status"). */
  status?: string[];
  /** One exact board name (toolbar "Pipeline"). */
  pipeline?: string;
  /** The Filter builder's applied conditions (ADR-0039) — the same JSON param the Leads list sends. */
  conditions?: string;
}

/** Which lead date the "By Date" window applies to (RPT-02.3). */
export type LeadsByStatusDateField = "created" | "statusChanged";

export const DATE_FIELD_OPTIONS: readonly {
  value: LeadsByStatusDateField;
  label: string;
}[] = [
  { value: "created", label: "Created Date" },
  { value: "statusChanged", label: "Status Changed Date" },
];

export type DatePeriodKey =
  | "today"
  | "yesterday"
  | "thisWeek"
  | "lastWeek"
  | "thisMonth"
  | "lastMonth"
  | "thisYear"
  | "lastYear"
  | "custom";

/** The "By Date" presets in the reference's order; "custom" opens the From/To pickers. */
export const DATE_PERIODS: readonly { key: DatePeriodKey; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "yesterday", label: "Yesterday" },
  { key: "thisWeek", label: "This Week" },
  { key: "lastWeek", label: "Last Week" },
  { key: "thisMonth", label: "This Month" },
  { key: "lastMonth", label: "Last Month" },
  { key: "thisYear", label: "This Year" },
  { key: "lastYear", label: "Last Year" },
  { key: "custom", label: "Custom" },
];

export function isDatePeriodKey(value: string | null): value is DatePeriodKey {
  return DATE_PERIODS.some((preset) => preset.key === value);
}

/** Monday — the UAE working week. */
const WEEK_STARTS_ON = 1;

/** A local calendar date as the `YYYY-MM-DD` the Custom range carries in the URL. */
export function dateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** The inverse of `dateKey`: local midnight of that date, or undefined for anything else. */
export function parseDateKey(key: string | undefined): Date | undefined {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return undefined;
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  // Round-trip, not isNaN: `new Date(2026, 12, 99)` silently rolls over to a valid date.
  return dateKey(date) === key ? date : undefined;
}

/**
 * The half-open [from, to) window of instants a preset means, computed in the client's
 * timezone (matching day-boundaries.ts) so "today" is the user's today. Custom takes the
 * picker's calendar dates, end inclusive.
 */
export function periodRange(
  key: DatePeriodKey,
  custom: { from?: string; to?: string } = {},
  now = new Date(),
): { from?: string; to?: string } {
  const day = (d: Date, offset = 0) =>
    new Date(d.getFullYear(), d.getMonth(), d.getDate() + offset);
  const month = (offset = 0) =>
    new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const year = (offset = 0) => new Date(now.getFullYear() + offset, 0, 1);
  const today = day(now);
  const week = day(today, -((today.getDay() - WEEK_STARTS_ON + 7) % 7));
  const window = (from: Date, to: Date) => ({
    from: from.toISOString(),
    to: to.toISOString(),
  });
  switch (key) {
    case "today":
      return window(today, day(today, 1));
    case "yesterday":
      return window(day(today, -1), today);
    case "thisWeek":
      return window(week, day(week, 7));
    case "lastWeek":
      return window(day(week, -7), week);
    case "thisMonth":
      return window(month(), month(1));
    case "lastMonth":
      return window(month(-1), month());
    case "thisYear":
      return window(year(), year(1));
    case "lastYear":
      return window(year(-1), year());
    case "custom": {
      const from = parseDateKey(custom.from);
      const to = parseDateKey(custom.to);
      return {
        from: from?.toISOString(),
        to: to ? day(to, 1).toISOString() : undefined,
      };
    }
  }
}

function appendFilters(
  params: URLSearchParams,
  filters: LeadsByStatusFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.conditions) params.set("conditions", filters.conditions);
  for (const team of filters.team ?? []) params.append("team", team);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const status of filters.status ?? []) params.append("status", status);
}

/** One scoped page of leads with their status (detailed view). */
export function fetchLeadsByStatusDetailed(
  page: number,
  size: number,
  filters: LeadsByStatusFilters,
  signal?: AbortSignal,
): Promise<ListResult<LeadsByStatusLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<LeadsByStatusLeadRow>>(
    "/reports/leads/by-status",
    params,
    signal,
  );
}

/** Lead counts per status + colour (summary view — drives the table and the chart). */
export function fetchLeadsByStatusSummary(
  filters: LeadsByStatusFilters,
  signal?: AbortSignal,
): Promise<ListResult<StatusCountRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<StatusCountRow>>(
    "/reports/leads/by-status/summary",
    params,
    signal,
  );
}

/** The team values the filter offers (AC3). */
export function fetchLeadsByStatusFilterOptions(
  signal?: AbortSignal,
): Promise<{ teams: string[] }> {
  return apiGet<{ teams: string[] }>(
    "/reports/leads/by-status/filter-options",
    undefined,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's
 * role scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadLeadsByStatusExport(
  filters: LeadsByStatusFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/by-status/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
