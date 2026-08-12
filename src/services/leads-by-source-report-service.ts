import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

/** An assignee reference, mirroring the backend `LeadsBySourceAgentRef`. */
export interface LeadsBySourceAgentRef {
  id: string;
  name: string;
}

/** One lead in the detailed view (RPT-02.4), mirroring `LeadsBySourceLeadRow`. */
export interface LeadsBySourceLeadRow {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  source: string | null;
  assignedTo: LeadsBySourceAgentRef[];
}

/** One breakdown row: lead count at a source, mirroring `SourceCountRow`. "No Source" = null bucket. */
export interface SourceCountRow {
  source: string;
  count: number;
}

/** The report's period/team filters (RPT-02.4 AC3). */
export interface LeadsBySourceFilters {
  /** Creation-window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  team?: string[];
}

/**
 * The period presets the control offers, applied to lead creation date. "Any time" (no lower
 * bound) is the default — the whole scoped set. `days` is turned into a client-timezone instant
 * at fetch time so it always tracks the user's today.
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
  filters: LeadsBySourceFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  for (const team of filters.team ?? []) params.append("team", team);
}

/** One scoped page of leads with their source (detailed view). */
export function fetchLeadsBySourceDetailed(
  page: number,
  size: number,
  filters: LeadsBySourceFilters,
  signal?: AbortSignal,
): Promise<ListResult<LeadsBySourceLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<LeadsBySourceLeadRow>>(
    "/reports/leads/by-source",
    params,
    signal,
  );
}

/** Lead counts per source (summary view — drives the table and the chart). */
export function fetchLeadsBySourceSummary(
  filters: LeadsBySourceFilters,
  signal?: AbortSignal,
): Promise<ListResult<SourceCountRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<SourceCountRow>>(
    "/reports/leads/by-source/summary",
    params,
    signal,
  );
}

/** The team values the filter offers (AC3). */
export function fetchLeadsBySourceFilterOptions(
  signal?: AbortSignal,
): Promise<{ teams: string[] }> {
  return apiGet<{ teams: string[] }>(
    "/reports/leads/by-source/filter-options",
    undefined,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadLeadsBySourceExport(
  filters: LeadsBySourceFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/by-source/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
