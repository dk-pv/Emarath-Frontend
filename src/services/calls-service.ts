import { apiGet, apiPatch } from "@/lib/api-client";

/** One KPI: its value for the period and the day-over-day change (CALL-03.1). */
export type CallKpi = {
  value: number;
  /** % change vs the preceding period of equal length; null when that was 0. */
  changePct: number | null;
};

/**
 * The Call summary KPIs from GET /api/calls/summary. The first six are the
 * CALL-03.1 backlog set; the rest complete the Workpex Summary carousel and
 * were ruled in on 2026-08-29 (their formulas live in the backend service).
 */
export type CallSummary = {
  freshCalls: CallKpi;
  followUpCallsCompleted: CallKpi;
  totalCalls: CallKpi;
  uniqueCalls: CallKpi;
  totalCallMinutes: CallKpi;
  averageCallTime: CallKpi;
  callConnectPct: CallKpi;
  outboundCalls: CallKpi;
  inboundCalls: CallKpi;
  missedCalls: CallKpi;
  abandonedCalls: CallKpi;
};

/** The resolved window + optional agent every Call Dashboard read is filtered by. */
export type CallRange = { from: string; to: string; agentId?: string | null };

/** `from`/`to`/`agentId` as the API expects them; `to` is exclusive. */
function rangeParams(range: CallRange): URLSearchParams {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  if (range.agentId) params.set("agentId", range.agentId);
  return params;
}

/**
 * Fetch the day-level KPI summary for a resolved period. `from`/`to` are ISO
 * instants (`to` exclusive); the client sends the user's local range so the
 * figures match their day, not the server's UTC default.
 */
export function fetchCallSummary(
  range: CallRange,
  signal?: AbortSignal,
): Promise<CallSummary> {
  return apiGet<CallSummary>("/calls/summary", rangeParams(range), signal);
}

/** One row of a Call Dashboard analytics panel. */
export type CallCountRow = { label: string; count: number };

/** The three panels under the leaderboard (GET /api/calls/analytics). */
export type CallAnalytics = {
  byStatus: CallCountRow[];
  bySource: CallCountRow[];
  byStage: CallCountRow[];
  /** The donut's centre figure. */
  total: number;
};

export function fetchCallAnalytics(
  range: CallRange,
  signal?: AbortSignal,
): Promise<CallAnalytics> {
  return apiGet<CallAnalytics>("/calls/analytics", rangeParams(range), signal);
}

/** Raise or clear one call's flag (PATCH /api/calls/:id/flag). */
export function setCallFlagged(
  id: string,
  flagged: boolean,
): Promise<{ flagged: boolean }> {
  return apiPatch<{ flagged: boolean }>(`/calls/${id}/flag`, { flagged });
}

/** One agent's ranked call metrics for the period (CALL-04.1). */
export type LeaderboardEntry = {
  agentId: string;
  agentName: string;
  totalCalls: number;
  uniqueCalls: number;
  answeredCalls: number;
  missedCalls: number;
  callConnectPct: number;
};

/** Fetch the agent leaderboard for a resolved period (GET /api/calls/leaderboard). */
export function fetchCallLeaderboard(
  range: CallRange,
  signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  return apiGet<LeaderboardEntry[]>(
    "/calls/leaderboard",
    rangeParams(range),
    signal,
  );
}

export type CallOutcome = "ANSWERED" | "NO_ANSWER" | "BUSY";
export type CallDirection = "INBOUND" | "OUTBOUND";

/** One Recent Call Log row (CALL-05.1). Dates arrive as ISO strings over JSON. */
export type CallLogRow = {
  id: string;
  leadId: string;
  leadName: string;
  phone: string;
  startedAt: string;
  outcome: CallOutcome;
  direction: CallDirection;
  leadStatus: string;
  nextFollowUp: string | null;
  leadNotes: string | null;
  callNotes: string | null;
  /** The PBX recording, when one exists — null leaves the download action inert. */
  audioUrl: string | null;
  flagged: boolean;
  leadSource: string | null;
  leadPipeline: string;
  assignedTo: { id: string; name: string }[];
  tags: { id: string; name: string }[];
};

export type CallLogResponse = {
  rows: CallLogRow[];
  total: number;
  page: number;
  size: number;
};

/** The Call Log filters (CALL-06.1): outcome tab, name/number search, lead status. */
/** The reference's Time Metric: which measure the log is ordered by. */
export type CallTimeMetric = "CALL_TIMING" | "CALL_DURATION";

export type CallLogFilters = {
  outcome?: CallOutcome;
  search?: string;
  leadStatus?: string;
  agentId?: string;
  timeMetric?: CallTimeMetric;
  /** "Show flagged calls only"; omitted means both flagged and unflagged. */
  flagged?: boolean;
  /** Rows per page; the API caps this at 100. */
  size?: number;
};

/** Fetch one page of the Recent Call Log for a resolved period (GET /api/calls/log). */
export function fetchCallLog(
  range: CallRange,
  page: number,
  filters: CallLogFilters = {},
  signal?: AbortSignal,
): Promise<CallLogResponse> {
  const params = rangeParams(range);
  params.set("page", String(page));
  if (filters.size) params.set("size", String(filters.size));
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.search) params.set("search", filters.search);
  if (filters.leadStatus) params.set("leadStatus", filters.leadStatus);
  if (filters.agentId) params.set("agentId", filters.agentId);
  if (filters.timeMetric) params.set("timeMetric", filters.timeMetric);
  if (filters.flagged) params.set("flagged", "true");
  return apiGet<CallLogResponse>("/calls/log", params, signal);
}
