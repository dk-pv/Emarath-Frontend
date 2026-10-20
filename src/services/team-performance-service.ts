import { apiGet } from "@/lib/api-client";
import {
  TEAM_PERFORMANCE_PATH,
  teamPerformanceParams,
  type TeamPerformanceFilterOptions,
  type TeamPerformanceFilters,
  type TeamPerformanceResult,
} from "@/lib/team-performance";

/** Teams and BDEs compared over the filtered leads, scoped to what the caller may see. */
export function fetchTeamPerformance(
  filters: TeamPerformanceFilters,
  signal?: AbortSignal,
): Promise<TeamPerformanceResult> {
  return apiGet<TeamPerformanceResult>(
    TEAM_PERFORMANCE_PATH,
    teamPerformanceParams(filters),
    signal,
  );
}

/** The teams, Sales Managers and BDEs the caller's filters may offer. */
export function fetchTeamPerformanceFilterOptions(
  signal?: AbortSignal,
): Promise<TeamPerformanceFilterOptions> {
  return apiGet<TeamPerformanceFilterOptions>(
    `${TEAM_PERFORMANCE_PATH}/filter-options`,
    undefined,
    signal,
  );
}
