import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult } from "@/types";

/** An assignee reference, mirroring the backend `NoActivityAgentRef`. */
export interface NoActivityAgentRef {
  id: string;
  name: string;
}

/** One affected lead in the detailed view (RPT-02.1), mirroring `NoActivityLeadRow`. */
export interface NoActivityLeadRow {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  /** Decimal as a string, so the precision survives the wire — pass it to `formatAED`. */
  actualAmount: string | null;
  pipeline: string;
  status: string;
  /** Stage colour key (KAN-05.1) for the status badge; null renders neutral. */
  statusColor: string | null;
  assignedTo: NoActivityAgentRef[];
  source: string | null;
  category: string | null;
  country: string | null;
  street: string | null;
  /** ISO instant of the lead's most recent completed activity, or null if never engaged. */
  lastActivityAt: string | null;
}

/** One summary row: affected-lead count per assignee, mirroring `NoActivitySummaryRow`. */
export interface NoActivitySummaryRow {
  agentId: string | null;
  agentName: string;
  count: number;
}

/** The report's toolbar filters (RPT-02.1 AC2): By Date, Sales Agent, Pipeline and Filter. */
export interface NoActivityFilters {
  /** Recency window lower bound — an ISO instant, derived from the selected period preset. */
  from?: string;
  source?: string[];
  agent?: string[];
  /** One exact board name; a lead belongs to exactly one pipeline. */
  pipeline?: string;
  /** Only leads with no assignee — what the summary's "Unassigned" row drills into. */
  unassigned?: boolean;
}

/**
 * The period presets the "By Date" control offers. A lead qualifies when it has had no
 * completed activity within the window; "Any time" (no lower bound) means it has never been
 * engaged. `days` is turned into a client-timezone instant at fetch time so it always tracks
 * today.
 */
export interface PeriodPreset {
  key: string;
  label: string;
  days: number | null;
}

export const PERIOD_PRESETS: readonly PeriodPreset[] = [
  { key: "any", label: "Any time", days: null },
  { key: "7", label: "No activity in 7 days", days: 7 },
  { key: "30", label: "No activity in 30 days", days: 30 },
  { key: "90", label: "No activity in 90 days", days: 90 },
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
  filters: NoActivityFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.pipeline) params.set("pipeline", filters.pipeline);
  if (filters.unassigned) params.set("unassigned", "true");
  for (const source of filters.source ?? []) params.append("source", source);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
}

/** One scoped page of affected leads with their last activity (detailed view). */
export function fetchNoActivityDetailed(
  page: number,
  size: number,
  filters: NoActivityFilters,
  signal?: AbortSignal,
): Promise<ListResult<NoActivityLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<NoActivityLeadRow>>(
    "/reports/leads/no-activity",
    params,
    signal,
  );
}

/** Affected-lead counts per assignee (summary view). */
export function fetchNoActivitySummary(
  filters: NoActivityFilters,
  signal?: AbortSignal,
): Promise<ListResult<NoActivitySummaryRow>> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<ListResult<NoActivitySummaryRow>>(
    "/reports/leads/no-activity/summary",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters (AC5). A plain anchor navigation streams
 * the attachment straight to disk (cookies ride along, so the server applies the caller's
 * role scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadNoActivityExport(filters: NoActivityFilters): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/no-activity/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
