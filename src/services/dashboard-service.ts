import { apiGet } from "@/lib/api-client";
import {
  LEADERBOARD_ROWS,
  SUMMARY_CARDS,
  TEAM_TOTALS,
} from "@/constants/dashboard";
import type { LeaderboardRow, SummaryCard } from "@/types";

/**
 * Dashboard data access.
 *
 * Returns fixture data today; the shape is what the API will return so callers do not
 * change when the backend lands. No fetching happens here yet by design.
 */
export type DashboardData = {
  summary: readonly SummaryCard[];
  leaderboard: readonly LeaderboardRow[];
  totals: typeof TEAM_TOTALS;
};

export function getDashboardData(): DashboardData {
  return {
    summary: SUMMARY_CARDS,
    leaderboard: LEADERBOARD_ROWS,
    totals: TEAM_TOTALS,
  };
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
 * Unlike the fixtures above, this is live: it is the one part of the Dashboard that
 * reads real leads today.
 */
export function fetchDashboardSummary(
  signal?: AbortSignal,
): Promise<DashboardSummary> {
  return apiGet<DashboardSummary>("/dashboard/summary", undefined, signal);
}
