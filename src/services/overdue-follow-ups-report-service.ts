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
 * One overdue follow-up in the detailed view (RPT-03.2), mirroring `OverdueFollowUpRow`. There is
 * no Workpex detailed capture; columns follow the Activities-list + report conventions.
 */
export interface OverdueFollowUpRow {
  id: string;
  type: FollowUpType;
  customerName: string;
  primaryPhone: string;
  dueAt: string;
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

/** The report's period/agent/team filters (RPT-03.2 AC2). */
export interface OverdueFollowUpsFilters {
  /**
   * The client's local midnight, the overdue cutoff (`dueAt < todayStart`). Always sent — reuses
   * the shared `dayBoundaries()` so "overdue" resolves to the same instant as the Activities tab.
   */
  todayStart: string;
  /** Creation-window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  agent?: string[];
  team?: string[];
}

/**
 * The period presets the control offers, applied to the follow-up's creation date (there is no
 * status-history timestamp on an activity). "Any time" (no lower bound) is the default — the whole
 * scoped set of overdue follow-ups. `days` is turned into a client-timezone instant at fetch time
 * so it always tracks the user's today.
 */
export interface PeriodPreset {
  key: string;
  label: string;
  days: number | null;
}

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { key: "any", label: "Any time", days: null },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
];

export const DEFAULT_PERIOD_KEY = "any";

/** Local midnight `days` ago as an ISO instant (timezone-correct, matching day-boundaries.ts). */
export function periodFrom(days: number | null): string | undefined {
  if (days == null) return undefined;
  const now = new Date();
  const start = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate() - days,
  );
  return start.toISOString();
}

function appendFilters(
  params: URLSearchParams,
  filters: OverdueFollowUpsFilters,
): void {
  params.set("todayStart", filters.todayStart);
  if (filters.from) params.set("from", filters.from);
  for (const id of filters.agent ?? []) params.append("agent", id);
  for (const team of filters.team ?? []) params.append("team", team);
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

/** Overdue-follow-up counts per assignee (summary view). */
export function fetchOverdueFollowUpsSummary(
  filters: OverdueFollowUpsFilters,
  signal?: AbortSignal,
): Promise<ListResult<OverdueFollowUpsSummaryRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<OverdueFollowUpsSummaryRow>>(
    "/reports/follow-ups/overdue/summary",
    params,
    signal,
  );
}

/** The team values the filter offers (AC2). */
export function fetchOverdueFollowUpsFilterOptions(
  signal?: AbortSignal,
): Promise<{ teams: string[] }> {
  return apiGet<{ teams: string[] }>(
    "/reports/follow-ups/overdue/filter-options",
    undefined,
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
