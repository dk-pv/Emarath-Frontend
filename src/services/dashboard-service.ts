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
