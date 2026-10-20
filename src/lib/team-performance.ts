/**
 * Team Performance (Teams v1, client acceptance criterion 11): the shapes
 * `GET /api/reports/team-performance` returns and the pure helpers the report renders with.
 *
 * The counting rules are the server's, restated so the screen can say them: a BDE's row counts
 * the leads assigned to them (a shared lead counts for each owner); a team's row counts the team's
 * leads once, however many members share one; the total counts the filtered set once.
 */

export const TEAM_PERFORMANCE_PATH = "/reports/team-performance";

export interface TeamPerformanceFigures {
  leads: number;
  won: number;
  orders: number;
  /** Won ÷ leads, a percentage to two places. */
  conversionRate: number;
  /** AED, a Decimal string. */
  wonValue: string;
}

export interface TeamPerformanceTeamRow extends TeamPerformanceFigures {
  /** Null: the leads of assignees with no team. */
  team: string | null;
  members: number | null;
  /** Σ the active members' monthly goals; null when none is set. */
  target: string | null;
  achievement: number | null;
}

export interface TeamPerformancePersonRow extends TeamPerformanceFigures {
  userId: string;
  name: string;
  team: string | null;
  target: string | null;
  achievement: number | null;
}

export interface TeamPerformanceResult {
  teams: TeamPerformanceTeamRow[];
  people: TeamPerformancePersonRow[];
  total: TeamPerformanceFigures;
}

export interface TeamPerformanceFilterOptions {
  teams: string[];
  managers: { id: string; name: string; team: string }[];
  agents: { id: string; name: string; team: string | null }[];
}

export interface TeamPerformanceFilters {
  from?: string;
  to?: string;
  dateField?: "created" | "statusChanged";
  team: readonly string[];
  agent: readonly string[];
  source: readonly string[];
  manager: string | null;
}

/** The query string the API reads: repeated keys for the lists, nothing for an unset filter. */
export function teamPerformanceParams(
  filters: TeamPerformanceFilters,
): URLSearchParams {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.dateField && filters.dateField !== "created") {
    params.set("dateField", filters.dateField);
  }
  if (filters.manager) params.set("manager", filters.manager);
  for (const team of filters.team) params.append("team", team);
  for (const agent of filters.agent) params.append("agent", agent);
  for (const source of filters.source) params.append("source", source);
  return params;
}

/** A bar's share of the largest value in its column, 0–100; 0 when the column is all zero. */
export function barShare(value: number, values: readonly number[]): number {
  const max = Math.max(0, ...values);
  return max > 0 ? Math.round((Math.max(0, value) / max) * 100) : 0;
}

/** Nothing to compare: no lead in the set and nobody to show. */
export function isTeamPerformanceEmpty(result: TeamPerformanceResult): boolean {
  return (
    result.total.leads === 0 &&
    result.people.length === 0 &&
    result.teams.length === 0
  );
}
