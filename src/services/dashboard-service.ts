import { apiGet } from "@/lib/api-client";
import { dayBoundaries, windowEdges } from "@/lib/day-boundaries";
import type { PeriodRange } from "@/lib/dashboard-period";
import type { ActivityListItem } from "@/services/activities-service";

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

/** One assignee of a hot lead. A lead carries 0..n of them. */
export interface HotLeadAgent {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
}

/**
 * One row of the Hot Leads widget (DASH-08.1). `value` is a decimal string, and
 * null — not "0" — when the lead carries no amount, so the table can dash it
 * rather than claim a zero-value lead.
 */
export interface HotLeadRow {
  leadId: string;
  leadName: string;
  assignedAgents: HotLeadAgent[];
  value: string | null;
}

export interface HotLeadsResponse {
  rows: HotLeadRow[];
  total: number;
  /** Every hot lead in the period, not this page's — paging cannot move it. */
  totalValue: string;
}

/**
 * Hot leads ranked by value, one page at a time. "Hot" is the API's own
 * definition, shared with the Hot Leads KPI counter, so the card and this table
 * can never disagree.
 */
export function fetchHotLeads(
  range: PeriodRange,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<HotLeadsResponse> {
  const params = periodParams(range);
  params.set("page", String(page));
  params.set("size", String(size));
  return apiGet<HotLeadsResponse>("/dashboard/hot-leads", params, signal);
}

/** The three at-risk buckets the widget offers (DASH-07.1). */
export type AttentionGroup = "overdue" | "noActivity" | "lost";

export interface AttentionAgent {
  agentId: string;
  agentName: string;
  avatarUrl: string | null;
}

export interface AttentionRow {
  leadId: string;
  leadName: string;
  assignedAgents: AttentionAgent[];
  /** ISO instant, rendered as the reference's two lines: date over time. */
  leadDateTime: string;
}

export interface LeadsAttentionResponse {
  counts: Record<AttentionGroup, number>;
  rows: AttentionRow[];
  /** Rows in the SELECTED group, role-scoped. */
  total: number;
}

/**
 * Counts for all three groups plus one page of the selected one. Every group is
 * the predicate its own report already owns, so the widget cannot drift from the
 * Overdue Follow Ups, No Activity or Lost Leads reports.
 */
export function fetchLeadsAttention(
  range: PeriodRange,
  group: AttentionGroup,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<LeadsAttentionResponse> {
  const params = periodParams(range);
  params.set("todayStart", dayBoundaries().todayStart);
  params.set("group", group);
  params.set("page", String(page));
  params.set("size", String(size));
  return apiGet<LeadsAttentionResponse>(
    "/dashboard/leads-attention",
    params,
    signal,
  );
}

/** The four cards on the Activities tracker, in the reference's order. */
export const ACTIVITY_TRACKER_GROUPS = [
  "overdue",
  "today",
  "tomorrow",
  "thisMonth",
] as const;

export type ActivityTrackerGroup = (typeof ACTIVITY_TRACKER_GROUPS)[number];

export interface ActivitiesTrackerResponse {
  counts: Record<ActivityTrackerGroup, number>;
  /** The worklist row shape — the Dashboard table reuses the Activities renderers. */
  rows: ActivityListItem[];
  /** Signed assignee avatar URLs keyed by user id; null where a member has no photo. */
  avatars: Record<string, string | null>;
  total: number;
}

/**
 * Counts for all four cards plus one page of the selected one (DASH-09.2).
 *
 * Deliberately not `GET /api/activities`: that endpoint returns the worklist's own
 * five tab counts (…/completed/all) and has no "this month", and its quick-date
 * windows narrow the counts as well as the page — so asking it for This Month would
 * silently re-scope the other three cards. This endpoint answers the four the widget
 * actually draws, from the same shared predicates.
 *
 * The widget carries no period filter of its own — its four buckets *are* the date
 * dimension — so the boundaries sent are the caller's local day and month edges,
 * computed here exactly as the Activities worklist computes them (ADR-0028 §3).
 */
export function fetchActivitiesTracker(
  group: ActivityTrackerGroup,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<ActivitiesTrackerResponse> {
  const days = dayBoundaries();
  const edges = windowEdges();
  const params = new URLSearchParams({
    group,
    page: String(page),
    size: String(size),
    todayStart: days.todayStart,
    todayEnd: days.todayEnd,
    tomorrowEnd: days.tomorrowEnd,
    monthStart: edges.monthStart,
    monthEnd: edges.monthEnd,
  });
  return apiGet<ActivitiesTrackerResponse>(
    "/dashboard/activities",
    params,
    signal,
  );
}

/** The Lead Source Summary's date dimension — the widget's Created/Assigned toggle. */
export type LeadSourceDateMode = "created" | "assigned";

export interface LeadSourceRow {
  source: string;
  /** One count per entry in `dates`, same order and length. */
  values: number[];
  total: number;
}

export interface LeadSourceSummary {
  /**
   * One ISO instant per column — the caller's own local midnight for that day. The
   * caption is drawn here with `formatDayLabel`, because only the browser knows
   * which calendar day that instant falls on for this user.
   */
  dates: string[];
  sources: LeadSourceRow[];
  /** Column totals — the pinned Total row. Same order as `dates`. */
  dailyTotals: number[];
  grandTotal: number;
  /** The scan ceiling clipped the window (only reachable on All, very large data). */
  truncated: boolean;
}

/**
 * Daily lead volume by acquisition source (DASH-10.1).
 *
 * `mode` selects the date dimension the *aggregation* runs on, not a label: `created`
 * counts `Lead.createdAt`, `assigned` counts `LeadAssignment.createdAt`. `todayStart`
 * goes with every request because it is the day boundary the columns are measured
 * from when the period is All and carries no bounds of its own.
 */
export function fetchLeadSourceSummary(
  range: PeriodRange,
  mode: LeadSourceDateMode,
  signal?: AbortSignal,
): Promise<LeadSourceSummary> {
  const params = periodParams(range);
  params.set("mode", mode);
  params.set("todayStart", dayBoundaries().todayStart);
  return apiGet<LeadSourceSummary>(
    "/dashboard/lead-source-summary",
    params,
    signal,
  );
}

/** The Leads vs Conversion breakdown — the widget's Lead Source / Sales Team toggle. */
export type LeadsConversionBreakdown = "source" | "team";

export interface LeadsConversionRow {
  category: string;
  leadCount: number;
  convertedCount: number;
}

export interface LeadsConversion {
  rows: LeadsConversionRow[];
  /**
   * Distinct leads in scope and period. Equals the row sum for `source`; for `team`
   * the rows can sum higher, because a lead assigned to two agents counts for each —
   * the Leads By Ownership rule.
   */
  totals: { leadCount: number; convertedCount: number };
}

/**
 * Leads and converted leads per category (DASH-11.1).
 *
 * `breakdown` selects the dimension the **aggregation** groups by, not a caption:
 * the lead's source, or the sales team member it is assigned to. "Converted" is the
 * product's one definition of the word — status WON — applied in the query.
 */
export function fetchLeadsConversion(
  range: PeriodRange,
  breakdown: LeadsConversionBreakdown,
  signal?: AbortSignal,
): Promise<LeadsConversion> {
  const params = periodParams(range);
  params.set("breakdown", breakdown);
  return apiGet<LeadsConversion>("/dashboard/leads-conversion", params, signal);
}

export interface SalesPipelineStage {
  pipeline: string;
  name: string;
  /** "New(LP)" — the stage, then its pipeline's short code. */
  label: string;
  count: number;
}

export interface SalesPipelineOverview {
  stages: SalesPipelineStage[];
  total: number;
}

/**
 * Every stage marked "Include In Sales Pipeline", in configured order, with the
 * leads sitting in it (DASH-12.1). The counts are the Kanban board's own rollup, so
 * a bar here and that stage's Kanban column cannot disagree.
 */
export function fetchSalesPipeline(
  range: PeriodRange,
  signal?: AbortSignal,
): Promise<SalesPipelineOverview> {
  return apiGet<SalesPipelineOverview>(
    "/dashboard/sales-pipeline",
    periodParams(range),
    signal,
  );
}
