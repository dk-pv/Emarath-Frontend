import { apiGet } from "@/lib/api-client";

/** One KPI: its value for the period and the day-over-day change (CALL-03.1). */
export type CallKpi = {
  value: number;
  /** % change vs the preceding period of equal length; null when that was 0. */
  changePct: number | null;
};

/** The six Call summary KPIs returned by GET /api/calls/summary (CALL-03.1). */
export type CallSummary = {
  totalCalls: CallKpi;
  uniqueCalls: CallKpi;
  totalCallMinutes: CallKpi;
  averageCallTime: CallKpi;
  callConnectPct: CallKpi;
  outboundCalls: CallKpi;
};

/**
 * Fetch the day-level KPI summary for a resolved period. `from`/`to` are ISO
 * instants (`to` exclusive); the client sends the user's local range so the
 * figures match their day, not the server's UTC default.
 */
export function fetchCallSummary(
  range: { from: string; to: string },
  signal?: AbortSignal,
): Promise<CallSummary> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return apiGet<CallSummary>("/calls/summary", params, signal);
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
  range: { from: string; to: string },
  signal?: AbortSignal,
): Promise<LeaderboardEntry[]> {
  const params = new URLSearchParams({ from: range.from, to: range.to });
  return apiGet<LeaderboardEntry[]>("/calls/leaderboard", params, signal);
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
};

export type CallLogResponse = {
  rows: CallLogRow[];
  total: number;
  page: number;
  size: number;
};

/** The Call Log filters (CALL-06.1): outcome tab, name/number search, lead status. */
export type CallLogFilters = {
  outcome?: CallOutcome;
  search?: string;
  leadStatus?: string;
};

/** Fetch one page of the Recent Call Log for a resolved period (GET /api/calls/log). */
export function fetchCallLog(
  range: { from: string; to: string },
  page: number,
  filters: CallLogFilters = {},
  signal?: AbortSignal,
): Promise<CallLogResponse> {
  const params = new URLSearchParams({
    from: range.from,
    to: range.to,
    page: String(page),
  });
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.search) params.set("search", filters.search);
  if (filters.leadStatus) params.set("leadStatus", filters.leadStatus);
  return apiGet<CallLogResponse>("/calls/log", params, signal);
}
