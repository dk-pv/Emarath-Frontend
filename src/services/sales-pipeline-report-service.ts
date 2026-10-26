import { apiGet, apiGetBlob } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";
import type { SalesFunnelStageRow } from "@/services/sales-funnel-report-service";

/** Pipeline Health or Closing Leads. */
export type SalesPipelineView = "health" | "closing";

/** The 3× rule's zones: below 1.5×, 1.5× to 3×, 3× and above. */
export type CoverageStatus = "critical" | "risk" | "on-track";

/** `GET /reports/sales-pipeline`. */
export interface SalesPipelineReport {
  pipeline: string;
  /** The pipeline's open sales stages, empty ones too. */
  stages: SalesFunnelStageRow[];
  totals: { leads: number; totalValue: string; weightedValue: string };
  /** Leads that became WON in the window. */
  won: number;
  /** This month's converted value against the members' monthly goals. */
  revenue: { achieved: string; target: string | null; percent: number | null };
  /** Open pipeline value ÷ this month's target; null without a target. */
  coverage: { ratio: number | null; status: CoverageStatus | null };
}

export interface SalesPipelineQuery {
  pipeline: string;
  /** The created-date window as instants, `[from, to)`; absent for all time. */
  from?: string;
  to?: string;
  agent: string | null;
  source: string | null;
  /** This calendar month in the viewer's timezone — the "(This Month)" figures. */
  monthFrom: string;
  monthTo: string;
}

/** The board's own filter names, as the Sales Funnel sends them. */
function salesPipelineParams(query: SalesPipelineQuery): URLSearchParams {
  const params = new URLSearchParams({
    pipeline: query.pipeline,
    monthFrom: query.monthFrom,
    monthTo: query.monthTo,
  });
  if (query.from) params.set("createdFrom", query.from);
  if (query.to) params.set("createdTo", query.to);
  if (query.agent) params.set("assignedAgent", query.agent);
  if (query.source) params.set("source", query.source);
  return params;
}

/** The open pipeline, Won, this month's revenue and coverage — role-scoped on the server. */
export function fetchSalesPipelineReport(
  query: SalesPipelineQuery,
  signal?: AbortSignal,
): Promise<SalesPipelineReport> {
  return apiGet<SalesPipelineReport>(
    "/reports/sales-pipeline",
    salesPipelineParams(query),
    signal,
  );
}

/**
 * Downloads the report as a PDF through the API client (a refused export throws an `ApiError`
 * the page can show); the server records the export in the audit log.
 */
export async function downloadSalesPipelinePdf(
  query: SalesPipelineQuery,
  view: SalesPipelineView,
  subtitle: string,
): Promise<void> {
  const params = salesPipelineParams(query);
  params.set("view", view);
  params.set("subtitle", subtitle);
  const blob = await apiGetBlob("/reports/sales-pipeline/export", params);
  saveBlob(blob, `sales-pipeline-${fileStamp(new Date())}.pdf`);
}

/** `YYYYMMDD-HHmmss` in local time — the other exports' naming pattern. */
function fileStamp(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
