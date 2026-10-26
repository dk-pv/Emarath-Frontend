import { apiGet, apiGetBlob } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";

/** Full Funnel View (every stage a lead has been in) or Live Funnel View (where it is now). */
export type SalesFunnelView = "full" | "live";

/** One stage of the funnel or the Stage Metrics table, as `GET /reports/sales-funnel` sends it. */
export interface SalesFunnelStageRow {
  stage: {
    id: string;
    name: string;
    /** The stage palette key (`stage-palette.ts`). */
    color: string;
    probability: number;
    isClosed: boolean;
    outcome: string | null;
  };
  count: number;
  /** DECIMAL strings, exact to the fils. */
  totalValue: string;
  weightedValue: string;
}

export interface SalesFunnelReport {
  view: SalesFunnelView;
  pipeline: string;
  funnel: SalesFunnelStageRow[];
  table: SalesFunnelStageRow[];
  totals: { leads: number; totalValue: string; weightedValue: string };
  /** Percent of every lead in scope now in a WON stage; null with no leads. */
  conversionRate: number | null;
}

export interface SalesFunnelQuery {
  pipeline: string;
  /** The created-date window as instants, `[from, to)`; absent for all time. */
  from?: string;
  to?: string;
  agent: string | null;
  source: string | null;
  view: SalesFunnelView;
  includeLost: boolean;
}

/** The board's own filter names (`createdFrom`/`createdTo`/`assignedAgent`/`source`). */
function salesFunnelParams(query: SalesFunnelQuery): URLSearchParams {
  const params = new URLSearchParams({
    pipeline: query.pipeline,
    view: query.view,
    includeLost: String(query.includeLost),
  });
  if (query.from) params.set("createdFrom", query.from);
  if (query.to) params.set("createdTo", query.to);
  if (query.agent) params.set("assignedAgent", query.agent);
  if (query.source) params.set("source", query.source);
  return params;
}

/** The report for one view: the funnel, Stage Metrics and the KPI figures, role-scoped. */
export function fetchSalesFunnelReport(
  query: SalesFunnelQuery,
  signal?: AbortSignal,
): Promise<SalesFunnelReport> {
  return apiGet<SalesFunnelReport>(
    "/reports/sales-funnel",
    salesFunnelParams(query),
    signal,
  );
}

/**
 * Downloads the report as a PDF. Fetched through the API client rather than a plain link, so an
 * expired session is refreshed and a refused export throws an `ApiError` the page can show; the
 * server records the export in the audit log.
 */
export async function downloadSalesFunnelPdf(
  query: SalesFunnelQuery,
  subtitle: string,
): Promise<void> {
  const params = salesFunnelParams(query);
  params.set("subtitle", subtitle);
  const blob = await apiGetBlob("/reports/sales-funnel/export", params);
  saveBlob(blob, `sales-funnel-${fileStamp(new Date())}.pdf`);
}

/** `YYYYMMDD-HHmmss` in local time — the other exports' naming pattern. */
function fileStamp(now: Date): string {
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
}
