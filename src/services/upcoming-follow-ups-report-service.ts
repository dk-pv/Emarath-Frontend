import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";
import type {
  FollowUpType,
  OverdueFollowUpsAgentRef,
} from "@/services/overdue-follow-ups-report-service";

/**
 * One upcoming follow-up (RPT-03.3) — open, due from tomorrow onward. The same six columns the
 * other two Follow Ups reports show, so the row shape is theirs: one projection on the server,
 * one set of columns on the client, three reports.
 */
export interface UpcomingFollowUpRow {
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
export interface UpcomingFollowUpsFilters {
  /**
   * The client's next local midnight — where "upcoming" starts, so the report opens with
   * tomorrow. From the shared `dayBoundaries()`, so the boundary is the user's own.
   */
  todayEnd: string;
  /**
   * The By Date window, as ISO instants. This report's whole axis is when work falls due, so
   * unlike Overdue (whose window filters the creation date) these bound `dueAt`.
   */
  from?: string;
  to?: string;
  /** Sales Agent — assignee ids. */
  agent?: string[];
  /** Pipeline — matched on the linked lead. */
  pipeline?: string[];
  /** Follow Up Type — Call / Meeting / Task. */
  type?: FollowUpType[];
}

function appendFilters(
  params: URLSearchParams,
  filters: UpcomingFollowUpsFilters,
): void {
  params.set("todayEnd", filters.todayEnd);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const id of filters.agent ?? []) params.append("agent", id);
  for (const value of filters.pipeline ?? []) params.append("pipeline", value);
  for (const value of filters.type ?? []) params.append("type", value);
}

/** One scoped page of the follow-ups due from tomorrow onward. */
export function fetchUpcomingFollowUps(
  page: number,
  size: number,
  filters: UpcomingFollowUpsFilters,
  signal?: AbortSignal,
): Promise<ListResult<UpcomingFollowUpRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<UpcomingFollowUpRow>>(
    "/reports/follow-ups/upcoming",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters. A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism every other report's export uses. Never a client-side dump.
 */
export function downloadUpcomingFollowUpsExport(
  filters: UpcomingFollowUpsFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/follow-ups/upcoming/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
