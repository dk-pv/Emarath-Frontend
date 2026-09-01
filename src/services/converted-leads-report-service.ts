import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";
import type { LeadListItem } from "@/services/leads-service";
import type { LeadsByStatusDateField } from "@/services/leads-by-status-report-service";

/**
 * One converted lead: the Leads list's own row shape (so `leadColumns` cells render it
 * unchanged) plus the resolved Stage colour and the conversion instant — mirrors
 * `ConvertedLeadRow`.
 */
export type ConvertedLeadRow = LeadListItem & {
  statusColor: string | null;
  convertedAt: string;
};

/** The report's filters — the same surface as the other rebuilt reports. */
export interface ConvertedLeadsFilters {
  from?: string;
  to?: string;
  dateField?: LeadsByStatusDateField;
  agent?: string[];
  source?: string[];
  pipeline?: string;
  conditions?: string;
}

function appendFilters(
  params: URLSearchParams,
  filters: ConvertedLeadsFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.conditions) params.set("conditions", filters.conditions);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const source of filters.source ?? []) params.append("source", source);
}

/** One scoped page of converted leads (the report's single, detailed view). */
export function fetchConvertedLeadsDetailed(
  page: number,
  size: number,
  filters: ConvertedLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<ConvertedLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<ConvertedLeadRow>>(
    "/reports/leads/converted",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadConvertedLeadsExport(
  filters: ConvertedLeadsFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/converted/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
