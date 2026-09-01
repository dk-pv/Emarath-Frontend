import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";
import type { LeadListItem } from "@/services/leads-service";
import type { LeadsByStatusDateField } from "@/services/leads-by-status-report-service";

/**
 * One lost lead: the Leads list's own row shape (so `leadColumns` cells render it
 * unchanged) plus the LOST stage colour and the loss instant — mirrors `LostLeadRow`.
 */
export type LostLeadRow = LeadListItem & {
  statusColor: string | null;
  lostAt: string;
  /** Why the lead was lost; null renders "No reason recorded". */
  lostReason: string | null;
};

/** One reason bucket, mirroring `LostReasonCountRow`. */
export interface LostReasonCountRow {
  reason: string;
  /** What the drill-down sends back as `reason` (`none` for the null bucket). */
  value: string;
  count: number;
}

/** The drill value for leads lost with no recorded reason; mirrors the backend. */
export const NO_REASON_VALUE = "none";

/** The report's filters — the same surface as the other rebuilt reports. */
export interface LostLeadsFilters {
  from?: string;
  to?: string;
  dateField?: LeadsByStatusDateField;
  team?: string[];
  agent?: string[];
  source?: string[];
  pipeline?: string;
  conditions?: string;
  /** Lost-reason buckets to narrow to (the summary drill-down). */
  reason?: string[];
}

function appendFilters(
  params: URLSearchParams,
  filters: LostLeadsFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.conditions) params.set("conditions", filters.conditions);
  for (const team of filters.team ?? []) params.append("team", team);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const source of filters.source ?? []) params.append("source", source);
  for (const reason of filters.reason ?? []) params.append("reason", reason);
}

/** One scoped page of lost leads (the report's single, detailed view). */
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

/** Lost-lead counts per reason (summary view — drives the table and the chart). */
export function fetchLostLeadsSummary(
  filters: LostLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<LostReasonCountRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<LostReasonCountRow>>(
    "/reports/leads/lost/summary",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism the Leads export uses. Never a client-side dump.
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
