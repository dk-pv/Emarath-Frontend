import { apiGet, apiGetBlob } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";
import type { LeadListItem } from "@/services/leads-service";

/** The Data Grid's "Group by" options, in the captured order. */
export type RevenueGroup =
  "none" | "pipeline" | "agent" | "role" | "status" | "source";

/** The grid columns whose header sorts — the Workpex grid's nine. */
export type RevenueSort =
  | "name"
  | "pipeline"
  | "assigned"
  | "status"
  | "actualAmount"
  | "secondaryPhone"
  | "product"
  | "language"
  | "country";

/** One window's KPI figures; amounts are AED Decimal strings. */
export interface RevenueFigures {
  revenue: string;
  deals: number;
  avgDealValue: string | null;
  conversionRate: number | null;
}

export interface RevenueSourceRow {
  source: string;
  revenue: string;
  deals: number;
  conversionRate: number | null;
  priorRevenue: string | null;
  change: number | null;
}

export interface RevenuePipelineRow {
  pipeline: string;
  revenue: string;
  deals: number;
  lost: number;
  winRate: number | null;
}

/** `GET /reports/revenue` — mirrors the backend's `RevenueOverviewResponse`. */
export interface RevenueOverview {
  current: RevenueFigures;
  prior: RevenueFigures | null;
  change: Record<keyof RevenueFigures, number | null>;
  target: {
    monthly: string | null;
    months: number | null;
    period: string | null;
    percent: number | null;
  };
  trend: { from: string; to: string; revenue: string; deals: number }[];
  sources: RevenueSourceRow[];
  pipelines: RevenuePipelineRow[];
}

/** One deal: the Leads list's own row plus its stage colour, conversion instant and group. */
export type RevenueDealRow = LeadListItem & {
  statusColor: string | null;
  convertedAt: string;
  groupKey: string | null;
};

/** `GET /reports/revenue/deals`. */
export interface RevenueDeals {
  rows: RevenueDealRow[];
  total: number;
  groups: { key: string; label: string; count: number }[];
  truncated: boolean;
}

/** The report's one query: the overview, the grid and the export never describe different deals. */
export interface RevenueQuery {
  /** The reporting period and the one it is compared with, `[from, to)`; absent for all time. */
  from?: string;
  to?: string;
  priorFrom?: string;
  priorTo?: string;
  /** The trend's bucket edges. */
  edges: readonly string[];
  /** The whole calendar months the period spans; null when it is not whole months. */
  targetMonths: number | null;
  agent: string | null;
  pipeline: string | null;
  /** The Filter builder's applied conditions. */
  conditions?: string;
}

export interface RevenueGridQuery {
  group: RevenueGroup;
  sort?: RevenueSort;
  direction?: "asc" | "desc";
}

function revenueParams(query: RevenueQuery): URLSearchParams {
  const params = new URLSearchParams();
  const set = (key: string, value: string | null | undefined) => {
    if (value) params.set(key, value);
  };
  set("from", query.from);
  set("to", query.to);
  set("priorFrom", query.priorFrom);
  set("priorTo", query.priorTo);
  for (const edge of query.edges) params.append("edge", edge);
  if (query.targetMonths)
    params.set("targetMonths", String(query.targetMonths));
  set("agent", query.agent);
  set("pipeline", query.pipeline);
  set("conditions", query.conditions);
  return params;
}

function gridParams(params: URLSearchParams, grid: RevenueGridQuery): void {
  if (grid.group !== "none") params.set("group", grid.group);
  if (grid.sort) params.set("sort", grid.sort);
  if (grid.direction) params.set("direction", grid.direction);
}

/** KPIs, target, trend and both breakdowns — role-scoped on the server. */
export function fetchRevenueOverview(
  query: RevenueQuery,
  signal?: AbortSignal,
): Promise<RevenueOverview> {
  return apiGet<RevenueOverview>(
    "/reports/revenue",
    revenueParams(query),
    signal,
  );
}

/** One sorted, grouped page of the Data Grid; group counts span every page. */
export function fetchRevenueDeals(
  query: RevenueQuery,
  grid: RevenueGridQuery & { page: number; size: number },
  signal?: AbortSignal,
): Promise<RevenueDeals> {
  const params = revenueParams(query);
  gridParams(params, grid);
  params.set("page", String(grid.page));
  params.set("size", String(grid.size));
  return apiGet<RevenueDeals>("/reports/revenue/deals", params, signal);
}

/**
 * Downloads the report and its deals, in the grid's order and grouping, as a PDF. Fetched through
 * the API client, so a refused export throws an `ApiError` the page can show; the server records
 * the export in the audit log.
 */
export async function downloadRevenuePdf(
  query: RevenueQuery,
  grid: RevenueGridQuery,
  meta: { subtitle: string; labels: readonly string[] },
): Promise<void> {
  const params = revenueParams(query);
  gridParams(params, grid);
  params.set("subtitle", meta.subtitle);
  for (const label of meta.labels) params.append("label", label);
  const blob = await apiGetBlob("/reports/revenue/export", params);
  saveBlob(blob, `revenue-report-${fileStamp(new Date())}.pdf`);
}

/** `YYYYMMDD-HHmmss` in local time — the other exports' naming pattern. */
function fileStamp(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
