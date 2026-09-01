import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";
import type { LeadListItem } from "@/services/leads-service";
import type { LeadsByStatusDateField } from "@/services/leads-by-status-report-service";

/**
 * One lead in the detailed view: the Leads list's own row shape (so `leadColumns` cells render
 * it unchanged) plus the resolved Stage colour for the status pill — mirrors `LeadsByOwnershipLeadRow`.
 */
export type LeadsByOwnershipLeadRow = LeadListItem & {
  statusColor: string | null;
};

/** The server's label for leads with no assignee. */
export const UNASSIGNED_LABEL = "Unassigned";

/** One owner's metrics, mirroring `OwnerCountRow`. Null `ownerId` is the Unassigned bucket. */
export interface OwnerCountRow {
  ownerId: string | null;
  ownerName: string;
  /** Total leads (a co-assigned lead counts for each owner). */
  count: number;
  newCount: number;
  contactedCount: number;
  noActivityCount: number;
  convertedCount: number;
  lostCount: number;
  /** Percentage 0–100. */
  conversionRatio: number;
  /** Null: Emarath has no qualification stage or flag. */
  qualifiedRatio: number | null;
  /** Null: Emarath has no sales-target model. */
  targetAchievement: number | null;
  /** Σ actualAmount, AED, as a Decimal string — pass to `formatAED`. */
  leadValue: string;
}

/** The report's filters — the same surface as Leads By Status / By Source. */
export interface LeadsByOwnershipFilters {
  from?: string;
  to?: string;
  dateField?: LeadsByStatusDateField;
  team?: string[];
  agent?: string[];
  source?: string[];
  pipeline?: string;
  conditions?: string;
  /** Only leads with no assignee — what the legend's "Unassigned" slice drills into. */
  unassigned?: boolean;
}

function appendFilters(
  params: URLSearchParams,
  filters: LeadsByOwnershipFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.dateField) params.set("dateField", filters.dateField);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.conditions) params.set("conditions", filters.conditions);
  if (filters.unassigned) params.set("unassigned", "true");
  for (const team of filters.team ?? []) params.append("team", team);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const source of filters.source ?? []) params.append("source", source);
}

/** One scoped page of leads with their assignees (detailed view). */
export function fetchLeadsByOwnershipDetailed(
  page: number,
  size: number,
  filters: LeadsByOwnershipFilters,
  signal?: AbortSignal,
): Promise<ListResult<LeadsByOwnershipLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<LeadsByOwnershipLeadRow>>(
    "/reports/leads/by-ownership",
    params,
    signal,
  );
}

/** Per-owner metrics (summary view — drives the table and the chart). */
export function fetchLeadsByOwnershipSummary(
  filters: LeadsByOwnershipFilters,
  signal?: AbortSignal,
): Promise<ListResult<OwnerCountRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<OwnerCountRow>>(
    "/reports/leads/by-ownership/summary",
    params,
    signal,
  );
}

/** The team values the filter offers (AC3). */
export function fetchLeadsByOwnershipFilterOptions(
  signal?: AbortSignal,
): Promise<{ teams: string[] }> {
  return apiGet<{ teams: string[] }>(
    "/reports/leads/by-ownership/filter-options",
    undefined,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadLeadsByOwnershipExport(
  filters: LeadsByOwnershipFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/by-ownership/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
