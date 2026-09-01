import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult, SortState } from "@/types";

/** The bucket a lead's age falls in, given the caller's thresholds. */
export type LeadHealth = "healthy" | "attention" | "stale";

/** The six metric cards, mirroring `LeadAgingKpis`. */
export interface LeadAgingKpis {
  totalTracked: number;
  stale: number;
  needsAttention: number;
  healthy: number;
  avgLeadAgeDays: number;
  noActivityEver: number;
}

/** One agent's aging profile, mirroring `LeadAgingAgentRow`. */
export interface LeadAgingAgentRow {
  /** Null for the "Unassigned" bucket. */
  agentId: string | null;
  agentName: string;
  green: number;
  amber: number;
  red: number;
  total: number;
  avgLeadAgeDays: number;
  avgAgeSinceAssignmentDays: number | null;
  avgDaysSinceActivityDays: number;
  noActivityEver: number;
}

export interface LeadAgingSummary {
  kpis: LeadAgingKpis;
  agents: LeadAgingAgentRow[];
}

export interface LeadAgingAgentRef {
  id: string;
  name: string;
}

/** One row of the Lead Aging Details table, mirroring `LeadAgingLeadRow`. */
export interface LeadAgingLeadRow {
  id: string;
  name: string;
  owner: LeadAgingAgentRef[];
  stage: string;
  stageColor: string | null;
  source: string | null;
  leadAgeDays: number;
  ageSinceAssignmentDays: number | null;
  daysSinceNoActivity: number;
  lastActivityAt: string | null;
  amount: string | null;
  health: LeadHealth;
}

/** The reference's defaults: Green ≤13d · Amber ≤29d · Red ≥30d. */
export const DEFAULT_THRESHOLDS = { green: 13, amber: 29 } as const;

/** Both thresholds in days; red is everything past `amber`. */
export interface AgingThresholds {
  green: number;
  amber: number;
}

/** The breakdown's period dropdown — a creation window the client computes. */
export type AgingPeriodKey = "all" | "month" | "quarter";

export const AGING_PERIODS: readonly {
  key: AgingPeriodKey;
  label: string;
}[] = [
  { key: "all", label: "All Active" },
  { key: "month", label: "This Month" },
  { key: "quarter", label: "This Quarter" },
];

/** The window's lower bound as an ISO instant, in the user's own timezone. */
export function periodFrom(key: AgingPeriodKey): string | undefined {
  if (key === "all") return undefined;
  const now = new Date();
  const month =
    key === "month" ? now.getMonth() : Math.floor(now.getMonth() / 3) * 3;
  return new Date(now.getFullYear(), month, 1).toISOString();
}

export interface LeadAgingFilters extends AgingThresholds {
  from?: string;
  to?: string;
  agent?: string[];
  status?: string[];
  unassigned?: boolean;
  includeLost?: boolean;
  /** One agent to narrow to on top of `agent` — the breakdown's row click. */
  owner?: string;
}

function appendFilters(
  params: URLSearchParams,
  filters: LeadAgingFilters,
): void {
  params.set("green", String(filters.green));
  params.set("amber", String(filters.amber));
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.includeLost) params.set("includeLost", "true");
  if (filters.unassigned) params.set("unassigned", "true");
  if (filters.owner) params.set("owner", filters.owner);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const status of filters.status ?? []) params.append("status", status);
}

/** The metric cards and the per-agent breakdown, over the whole scoped set. */
export function fetchLeadAgingSummary(
  filters: LeadAgingFilters,
  signal?: AbortSignal,
): Promise<LeadAgingSummary> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<LeadAgingSummary>(
    "/reports/leads/aging/summary",
    params,
    signal,
  );
}

/** One scoped page of the Lead Aging Details table. */
export function fetchLeadAgingDetailed(
  page: number,
  size: number,
  filters: LeadAgingFilters,
  sort: SortState | undefined,
  signal?: AbortSignal,
): Promise<ListResult<LeadAgingLeadRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (sort) {
    params.set("sort", sort.key);
    params.set("direction", sort.direction);
  }
  appendFilters(params, filters);
  return apiGet<ListResult<LeadAgingLeadRow>>(
    "/reports/leads/aging",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters. A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadLeadAgingExport(filters: LeadAgingFilters): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/aging/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
