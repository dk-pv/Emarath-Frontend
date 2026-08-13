import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

/** An assignee reference, mirroring the backend `ConvertedLeadsAgentRef`. */
export interface ConvertedLeadsAgentRef {
  id: string;
  name: string;
}

/**
 * One converted lead in the detailed view (RPT-02.6), mirroring `ConvertedLeadRow`. `actualAmount`
 * is the confirmed value in AED, a string (Decimal preserved), or null when the lead has none.
 */
export interface ConvertedLeadRow {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  source: string | null;
  assignedTo: ConvertedLeadsAgentRef[];
  actualAmount: string | null;
}

/**
 * One summary row: converted-lead count + total converted amount per assignee, mirroring
 * `ConvertedLeadsSummaryRow`. `agentId` is null for the "Unassigned" bucket and the "Total" row
 * (flagged `isTotal`); `amount` is an AED string.
 */
export interface ConvertedLeadsSummaryRow {
  agentId: string | null;
  agentName: string;
  count: number;
  amount: string;
  isTotal?: boolean;
}

/** The report's period/agent/source filters (RPT-02.6 AC3). */
export interface ConvertedLeadsFilters {
  /** Creation-window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  source?: string[];
  agent?: string[];
}

/**
 * The period presets the control offers, applied to lead creation date (there is no conversion
 * timestamp in the model). "Any time" (no lower bound) is the default — the whole scoped set of
 * converted leads. `days` is turned into a client-timezone instant at fetch time so it always
 * tracks the user's today.
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
  filters: ConvertedLeadsFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  for (const source of filters.source ?? []) params.append("source", source);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
}

/** One scoped page of converted leads with their amount (detailed view). */
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

/** Converted-lead count + total converted amount per assignee (summary view). */
export function fetchConvertedLeadsSummary(
  filters: ConvertedLeadsFilters,
  signal?: AbortSignal,
): Promise<ListResult<ConvertedLeadsSummaryRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<ConvertedLeadsSummaryRow>>(
    "/reports/leads/converted/summary",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role scope)
 * — the same mechanism the Leads export uses. Never a client-side dump.
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
