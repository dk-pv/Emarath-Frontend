import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

export type FollowUpType = "CALL" | "MEETING" | "TASK";

/** The Workpex "Follow Up Type" labels — same casing the Activities list uses. */
export const FOLLOW_UP_TYPE_LABEL: Record<FollowUpType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  TASK: "Task",
};

/** An assignee reference, mirroring the backend `OverdueFollowUpsAgentRef`. */
export interface OverdueFollowUpsAgentRef {
  id: string;
  name: string;
}

/**
 * One overdue follow-up in the detailed view (RPT-03.2), mirroring `OverdueFollowUpRow`: the
 * reference's six columns — Lead Name, Lead Status, Assigned User, Follow up Type, Date and
 * Time, Notes.
 */
export interface OverdueFollowUpRow {
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
  /** The follow-up's own description — the reference's Notes column. */
  notes: string | null;
  assignedTo: OverdueFollowUpsAgentRef[];
}

/**
 * One summary row: overdue-follow-up count per assignee ("Assigned User | Overdue Count"),
 * mirroring `OverdueFollowUpsSummaryRow`. `agentId` is null only for the "Unassigned" bucket;
 * there is no "Total" row (Workpex parity).
 */
export interface OverdueFollowUpsSummaryRow {
  agentId: string | null;
  agentName: string;
  count: number;
}

/** The report's toolbar filters (RPT-03.2 AC2). */
export interface OverdueFollowUpsFilters {
  /**
   * The client's local midnight, the overdue cutoff (`dueAt < todayStart`). Always sent — reuses
   * the shared `dayBoundaries()` so "overdue" resolves to the same instant as the Activities tab.
   */
  todayStart: string;
  /** The By Date window over the follow-up's creation date — half-open ISO instants. */
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
  filters: OverdueFollowUpsFilters,
): void {
  params.set("todayStart", filters.todayStart);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const id of filters.agent ?? []) params.append("agent", id);
  for (const value of filters.pipeline ?? []) params.append("pipeline", value);
  for (const value of filters.type ?? []) params.append("type", value);
}

/** One scoped page of overdue follow-ups (detailed view). */
export function fetchOverdueFollowUpsDetailed(
  page: number,
  size: number,
  filters: OverdueFollowUpsFilters,
  signal?: AbortSignal,
): Promise<ListResult<OverdueFollowUpRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<OverdueFollowUpRow>>(
    "/reports/follow-ups/overdue",
    params,
    signal,
  );
}

/**
 * One page of the per-assignee overdue counts (summary view). `total` counts assignee rows —
 * the pager's total — not follow-ups: a co-assigned follow-up is counted once per assignee.
 */
export function fetchOverdueFollowUpsSummary(
  page: number,
  size: number,
  filters: OverdueFollowUpsFilters,
  signal?: AbortSignal,
): Promise<ListResult<OverdueFollowUpsSummaryRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<OverdueFollowUpsSummaryRow>>(
    "/reports/follow-ups/overdue/summary",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters. A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role scope)
 * — the same mechanism the Leads/Lost Leads exports use. Never a client-side dump.
 */
export function downloadOverdueFollowUpsExport(
  filters: OverdueFollowUpsFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/follow-ups/overdue/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
