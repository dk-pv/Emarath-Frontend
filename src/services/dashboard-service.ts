import { apiGet } from "@/lib/api-client";
import { dayBoundaries } from "@/lib/day-boundaries";
import type { PeriodRange } from "@/lib/dashboard-period";

/**
 * Dashboard data access. Every read here is live and role-scoped by the API — the
 * fixtures this module used to return are gone with DASH-03/04/05.
 */

/**
 * One top-of-dashboard counter, as `GET /api/dashboard/kpis` returns it.
 *
 * `value` is nullable because the API reports a counter whose business rule has not
 * been agreed as `pending-definition` rather than inventing a figure — `qualifiedLeads`
 * is in that state today. A money counter arrives as a decimal string, the project's
 * rule for anything that must not lose precision on the wire.
 */
export interface DashboardKpiCounter {
  value: number | string | null;
  status: "ok" | "pending-definition";
  reason?: string;
}

/**
 * Whatever counters the API implements. Keyed loosely on purpose: the carousel asks for
 * all nineteen cards and treats a key the response does not carry as unavailable, so a
 * new backend counter appears on its card with no frontend change.
 */
export type DashboardKpis = Record<string, DashboardKpiCounter | undefined>;

/**
 * The counters for one window, scoped to the caller by the API (never in the UI).
 *
 * `counters` is deliberately not sent: naming keys would cap the response at the six
 * this build knows about, and the point is that the API decides what it can answer.
 * `todayStart` is the caller's own local midnight, which is what makes "overdue" mean
 * the user's today rather than the server's (ADR-0028 §3).
 */
export function fetchDashboardKpis(
  range: PeriodRange,
  signal?: AbortSignal,
): Promise<DashboardKpis> {
  const params = new URLSearchParams({
    todayStart: dayBoundaries().todayStart,
  });
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  return apiGet<DashboardKpis>("/dashboard/kpis", params, signal);
}

/** One configured summary card, as `/api/dashboard/summary` returns it. */
export interface DashboardSummaryCard {
  fieldKey: string;
  label: string;
  count: number;
  /** Summed actual amount, as a string — Decimal precision must survive the wire. */
  amount: string;
}

export interface DashboardSummary {
  summaryMode: "LEAD_STAGE" | "LEAD_SOURCE";
  displayOnCards: "BOTH" | "LEAD_COUNT" | "AMOUNT";
  cards: DashboardSummaryCard[];
}

/**
 * The stage or source cards Settings → Application Controls → Dashboard Settings
 * configured, counted and summed under the caller's own role scope.
 *
 * No role gate: the Dashboard is every user's landing page, and the rows are already
 * scoped by the API.
 */
export function fetchDashboardSummary(
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>("/dashboard/summary", undefined, signal);
}

/**
 * The half-open window a team widget covers. Unlike the KPI counters these need no
 * `todayStart` — none of them means anything by "overdue".
 */
function periodParams(range: PeriodRange): URLSearchParams {
  const params = new URLSearchParams();
  if (range.from) params.set("from", range.from);
  if (range.to) params.set("to", range.to);
  return params;
}

/** The Sales Team Activity Board's left rail (DASH-03.1). */
export interface TeamRevenue {
  totalLeads: number;
  totalCalls: number;
  /** Decimal string — money precision must survive the wire. */
  totalConversion: string;
  /** Uncapped; null when the team has no revenue target set, rendered as NA. */
  pctRevenueTargetAchieved: number | null;
}

export function fetchTeamRevenue(
  range: PeriodRange,
  signal?: AbortSignal,
): Promise<TeamRevenue> {
  return apiGet<TeamRevenue>(
    "/dashboard/team-revenue",
    periodParams(range),
    signal,
  );
}

/** One agent's leaderboard card (DASH-04.1). Both percentages may exceed 100. */
export interface SalesLeaderboardEntry {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  leads: number;
  calls: number;
  convertedAmount: string;
  /** Null when no leads were assigned in the period — rendered as NA, never 0 %. */
  conversionRate: number | null;
  /** Null when the member has no monthly goal set — rendered as NA. */
  pctRevenueTargetAchieved: number | null;
}

export function fetchSalesLeaderboard(
  range: PeriodRange,
  signal?: AbortSignal,
): Promise<SalesLeaderboardEntry[]> {
  return apiGet<SalesLeaderboardEntry[]>(
    "/dashboard/leaderboard",
    periodParams(range),
    signal,
  );
}

/** One row of the Call Activity Board (DASH-05.1). */
export interface CallActivityRow {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
  totalCalls: number;
  uniqueCalls: number;
  answeredCalls: number;
  callMinutes: number;
  averageCallTime: number;
}

/**
 * One page of the board plus the role-scoped agent total — `{ rows, total }`, the
 * shape every paginated list in the product returns.
 */
export interface CallActivityPage {
  rows: CallActivityRow[];
  total: number;
}

/**
 * Reads the Call Dashboard's own per-agent aggregation, so this board and that
 * screen can never report different figures for the same agent and period.
 *
 * Paged on the server: the browser receives one page and a total it does not have
 * to derive, so the footer's range is never computed from a partial set.
 */
export function fetchCallActivity(
  range: PeriodRange,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<CallActivityPage> {
  const params = periodParams(range);
  params.set("page", String(page));
  params.set("size", String(size));
  return apiGet<CallActivityPage>("/dashboard/call-activity", params, signal);
}
