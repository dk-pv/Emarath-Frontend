import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

/** An assignee reference, mirroring the backend `TodayLeadsAgentRef`. */
export interface TodayLeadsAgentRef {
  id: string;
  name: string;
}

/** One lead reached (an answered call) in the window — the detailed view, mirroring `TodayLeadRow`. */
export interface TodayLeadRow {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  /** Lead.createdAt — the detailed view's "Created Date". */
  createdAt: string;
  /** The latest assignment's instant — "Assigned Date"; null when unassigned. */
  assignedDate: string | null;
  source: string | null;
  status: string;
  /** Stage colour key (KAN-05.1) for the status badge; null renders neutral. */
  statusColor: string | null;
  language: string | null;
  callStatus: string | null;
  country: string | null;
  assignedTo: TodayLeadsAgentRef[];
  /** The lead's existing engagement counters (LEAD-01.3) — "high engagement", shown not scored. */
  callAttempts: number;
  whatsappAttempts: number;
  /** ISO instant of the lead's most recent answered call, or null if it has none. */
  lastContactedAt: string | null;
  /** The lead's soonest outstanding follow-up (earliest incomplete activity), or null. */
  nextFollowUpAt: string | null;
}

/** One summary row: recently-contacted-lead count per assignee, mirroring `TodayLeadsSummaryRow`. */
export interface TodayLeadsSummaryRow {
  agentId: string | null;
  agentName: string;
  count: number;
}

/** The report's toolbar filters (RPT-02.2 AC2): Contacted, Sales Agent, Pipeline, Filter. */
export interface TodayLeadsFilters {
  /** Contact-window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  source?: string[];
  agent?: string[];
  /** One exact board name; a lead belongs to exactly one pipeline. */
  pipeline?: string;
}

/**
 * The period presets the control offers. A lead qualifies when it has a call within the
 * window; the report is "Today Leads", so the default is today. `days` is turned into a
 * client-timezone instant at fetch time so it always tracks the user's today.
 */
export interface PeriodPreset {
  key: string;
  label: string;
  days: number;
}

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { key: "today", label: "Today", days: 0 },
  { key: "7", label: "Last 7 days", days: 7 },
  { key: "30", label: "Last 30 days", days: 30 },
  { key: "90", label: "Last 90 days", days: 90 },
];

export const DEFAULT_PERIOD_KEY = "today";

/** Local midnight `days` ago as an ISO instant (timezone-correct, matching day-boundaries.ts). */
export function periodFrom(days: number): string {
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
  filters: TodayLeadsFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  for (const source of filters.source ?? []) params.append("source", source);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
}

/** One scoped page of recently-contacted leads with their last contact (detailed view). */
export function fetchTodayLeadsDetailed(
  page: number,
  size: number,
  filters: TodayLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<TodayLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<TodayLeadRow>>(
    "/reports/leads/today",
    params,
    signal,
  );
}

/** Recently-contacted-lead counts per assignee (summary view). */
export function fetchTodayLeadsSummary(
  filters: TodayLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<TodayLeadsSummaryRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<TodayLeadsSummaryRow>>(
    "/reports/leads/today/summary",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's
 * role scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadTodayLeadsExport(filters: TodayLeadsFilters): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/today/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
