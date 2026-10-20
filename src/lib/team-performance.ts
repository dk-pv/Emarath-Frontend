/**
 * Team Performance (Teams v1, client acceptance criterion 11): the shapes
 * `GET /api/reports/team-performance` returns and the pure helpers the report renders with.
 *
 * The counting rules are the server's, restated so the screen can say them: a BDE's row counts
 * the leads assigned to them (a shared lead counts for each owner); a team's row counts the team's
 * leads once, however many members share one; the total counts the filtered set once. The
 * Financial Dashboard reads the same endpoint for its money figures.
 */
import type { LogisticsStatus } from "./logistics-orders";

export const TEAM_PERFORMANCE_PATH = "/reports/team-performance";

/** One Logistics status among a row's orders: how many are in it now, and Σ their Order Value. */
export interface OrderStatusFigures {
  status: LogisticsStatus;
  orders: number;
  /** AED, a Decimal string — the value recorded on the orders, never a payment. */
  value: string;
  /** Of `orders`, those with no Order Value recorded. */
  unvalued: number;
}

export interface TeamPerformanceFigures {
  leads: number;
  won: number;
  orders: number;
  /** Won ÷ leads, a percentage to two places. */
  conversionRate: number;
  /** AED, a Decimal string. */
  wonValue: string;
  /** Won leads with no Actual Amount: counted in `won`, adding nothing to `wonValue`. */
  wonUnvalued: number;
  /** Σ Order Value of the row's orders, whatever their status (AED, a Decimal string). */
  orderValue: string;
  /** The orders by their status now: every status, in pipeline order. */
  orderStatus: OrderStatusFigures[];
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

/** The date the window applies to: the lead's creation, its last status change, or its order's. */
export type TeamPerformanceDateField =
  "created" | "statusChanged" | "orderCreated";

export interface TeamPerformanceFilters {
  from?: string;
  to?: string;
  dateField?: TeamPerformanceDateField;
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
