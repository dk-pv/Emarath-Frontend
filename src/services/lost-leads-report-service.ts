import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

/** An assignee reference, mirroring the backend `LostLeadsAgentRef`. */
export interface LostLeadsAgentRef {
  id: string;
  name: string;
}

/**
 * One lost lead in the detailed view (RPT-02.7), mirroring `LostLeadRow`. `status` is always
 * "LOST" (the report's definition) with its Stage colour key; there is no loss-reason field.
 */
export interface LostLeadRow {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  source: string | null;
  status: string;
  statusColor: string | null;
  assignedTo: LostLeadsAgentRef[];
}

/**
 * One summary row: lost-lead count per assignee, mirroring `LostLeadsSummaryRow`. `agentId` is
 * null for the "Unassigned" bucket and the "Total" row (flagged `isTotal`).
 */
export interface LostLeadsSummaryRow {
  agentId: string | null;
  agentName: string;
  count: number;
  isTotal?: boolean;
}

/** The report's period/team filters (RPT-02.7 AC3). */
export interface LostLeadsFilters {
  /** Creation-window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  team?: string[];
}

/**
 * The period presets the control offers, applied to lead creation date (there is no lost
 * timestamp in the model). "Any time" (no lower bound) is the default — the whole scoped set of
 * lost leads. `days` is turned into a client-timezone instant at fetch time so it always tracks
 * the user's today.
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
  filters: LostLeadsFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  for (const team of filters.team ?? []) params.append("team", team);
}

/** One scoped page of lost leads (detailed view). */
export function fetchLostLeadsDetailed(
  page: number,
  size: number,
  filters: LostLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<LostLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<LostLeadRow>>("/reports/leads/lost", params, signal);
}

/** Lost-lead counts per assignee (summary view). */
export function fetchLostLeadsSummary(
  filters: LostLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<LostLeadsSummaryRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<LostLeadsSummaryRow>>(
    "/reports/leads/lost/summary",
    params,
    signal,
  );
}

/** The team values the filter offers (AC3). */
export function fetchLostLeadsFilterOptions(
  signal?: AbortSignal,
): Promise<{ teams: string[] }> {
  return apiGet<{ teams: string[] }>(
    "/reports/leads/lost/filter-options",
    undefined,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role scope)
 * — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadLostLeadsExport(filters: LostLeadsFilters): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/lost/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
