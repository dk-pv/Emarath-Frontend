import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";
import type {
  FollowUpType,
  OverdueFollowUpsAgentRef,
} from "@/services/overdue-follow-ups-report-service";

/**
 * One follow-up due today (RPT-03.1). The same six columns the Overdue report's table shows, so
 * the row shape is that report's — one projection on the server, one set of columns on the
 * client, two reports.
 */
export interface TodaysFollowUpRow {
  id: string;
  type: FollowUpType;
  /** Makes the Lead Name a link to that customer's details page. */
  leadId: string;
  customerName: string;
  primaryPhone: string;
  status: string;
  /** The status's real Stage colour, so the badge matches its pill everywhere else. */
  statusColor: string | null;
  dueAt: string;
  /** The follow-up's own description — the Notes column. */
  notes: string | null;
  assignedTo: OverdueFollowUpsAgentRef[];
}

/** The report's toolbar filters, plus the day window the server needs. */
export interface TodaysFollowUpsFilters {
  /**
   * The client's local midnight and the next one — the half-open day. Always sent, from the
   * shared `dayBoundaries()`, so "today" resolves to the same instants as the Activities tab.
   */
  todayStart: string;
  todayEnd: string;
  /** Sales Agent — assignee ids. */
  agent?: string[];
  /** Pipeline — matched on the linked lead. */
  pipeline?: string[];
  /** Follow Up Type — Call / Meeting / Task. */
  type?: FollowUpType[];
}

function appendFilters(
  params: URLSearchParams,
  filters: TodaysFollowUpsFilters,
): void {
  params.set("todayStart", filters.todayStart);
  params.set("todayEnd", filters.todayEnd);
  for (const id of filters.agent ?? []) params.append("agent", id);
  for (const value of filters.pipeline ?? []) params.append("pipeline", value);
  for (const value of filters.type ?? []) params.append("type", value);
}

/** One scoped page of the follow-ups due today. */
export function fetchTodaysFollowUps(
  page: number,
  size: number,
  filters: TodaysFollowUpsFilters,
  signal?: AbortSignal,
): Promise<ListResult<TodaysFollowUpRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<TodaysFollowUpRow>>(
    "/reports/follow-ups/today",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters. A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism every other report's export uses. Never a client-side dump.
 */
export function downloadTodaysFollowUpsExport(
  filters: TodaysFollowUpsFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/follow-ups/today/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
