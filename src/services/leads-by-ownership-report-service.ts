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
  /**
   * The owner's leads in this report that have a Logistics order, whatever its status since —
   * not the same as `convertedCount` (a WON lead from before Logistics has no order).
   */
  ordersCount: number;
  /** Percentage 0–100. */
  conversionRatio: number;
  /** Null: Emarath has no qualification stage or flag. */
  qualifiedRatio: number | null;
  /**
   * Σ actualAmount of the owner's WON leads in the report ÷ their monthly goal, as a percentage,
   * uncapped. Null when there is no goal (or a zero one), and for the Unassigned bucket.
   */
  targetAchievement: number | null;
  /** Σ actualAmount, AED, as a Decimal string — pass to `formatAED`. */
  leadValue: string;
}

/**
 * One team's subtotal of the owner rows, mirroring `TeamSubtotalRow`. `team` null is the owners
 * with no team; the Unassigned bucket belongs to no team and is left out.
 */
export interface TeamSubtotalRow {
  team: string | null;
  /** How many owner rows the subtotal adds up. */
  owners: number;
  count: number;
  newCount: number;
  contactedCount: number;
  noActivityCount: number;
  convertedCount: number;
  lostCount: number;
  ordersCount: number;
  conversionRatio: number;
  /** WON value ÷ the team's active members' goals; null with no goal and for no team. */
  targetAchievement: number | null;
  leadValue: string;
}

/** The summary: per-owner rows, the distinct lead total, and the team subtotals. */
export type LeadsByOwnershipSummary = ListResult<OwnerCountRow> & {
  /** Empty for a sales agent, who sees only their own row. */
  teams: TeamSubtotalRow[];
};

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

/** Per-owner metrics (summary view — drives the table and the chart) and the team subtotals. */
export function fetchLeadsByOwnershipSummary(
  filters: LeadsByOwnershipFilters,
  signal?: AbortSignal,
): Promise<LeadsByOwnershipSummary> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<LeadsByOwnershipSummary>(
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
