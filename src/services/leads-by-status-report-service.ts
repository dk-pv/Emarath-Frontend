import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

/** An assignee reference, mirroring the backend `LeadsByStatusAgentRef`. */
export interface LeadsByStatusAgentRef {
  id: string;
  name: string;
}

/** One lead in the detailed view (RPT-02.3), mirroring `LeadsByStatusLeadRow`. */
export interface LeadsByStatusLeadRow {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  source: string | null;
  status: string;
  /** Stage colour KEY (`violet`, `amber`, …) or null; mapped to tokens via stage-palette. */
  statusColor: string | null;
  assignedTo: LeadsByStatusAgentRef[];
}

/** One breakdown row: lead count at a status + its stage colour key, mirroring `StatusCountRow`. */
export interface StatusCountRow {
  status: string;
  count: number;
  color: string | null;
}

/** The report's period/team filters (RPT-02.3 AC3). */
export interface LeadsByStatusFilters {
  /** Creation-window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  team?: string[];
}

/**
 * The period presets the control offers, applied to lead creation date. "Any time" (no lower
 * bound) is the default — the whole scoped set. `days` is turned into a client-timezone
 * instant at fetch time so it always tracks the user's today.
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
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days);
  return start.toISOString();
}

function appendFilters(
  params: URLSearchParams,
  filters: LeadsByStatusFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  for (const team of filters.team ?? []) params.append("team", team);
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
