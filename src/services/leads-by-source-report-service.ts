import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";
import type { LeadListItem } from "@/services/leads-service";
import type { LeadsByStatusDateField } from "@/services/leads-by-status-report-service";

/**
 * One lead in the detailed view: the Leads list's own row shape (so `leadColumns` cells render
 * it unchanged) plus the resolved Stage colour for the status pill — mirrors `LeadsBySourceLeadRow`.
 */
export type LeadsBySourceLeadRow = LeadListItem & {
  statusColor: string | null;
};

/** The bucket the server folds null and blank sources into; mirrors the backend label. */
export const NO_SOURCE_LABEL = "No Source";

/** One breakdown row: lead count at a source, mirroring `SourceCountRow`. */
export interface SourceCountRow {
  source: string;
  count: number;
  /** The bucket's share of the filtered total, as a percentage 0–100. */
  share: number;
  /** Share of the bucket that has converted (status WON), as a percentage 0–100. */
  conversionRate: number;
}

/**
 * The report's filters — the same surface as Leads By Status: a window on the created or
 * status-changed date, plus agent, source, pipeline, team and the condition builder's payload.
 */
export interface LeadsBySourceFilters {
  from?: string;
  to?: string;
  dateField?: LeadsByStatusDateField;
  team?: string[];
  agent?: string[];
  source?: string[];
  pipeline?: string;
  conditions?: string;
}

function appendFilters(
  params: URLSearchParams,
  filters: LeadsBySourceFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.conditions) params.set("conditions", filters.conditions);
  for (const team of filters.team ?? []) params.append("team", team);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const source of filters.source ?? []) params.append("source", source);
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

/** Lead counts and conversion rate per source (summary view — drives the table and the chart). */
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
