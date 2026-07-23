import { apiGet, apiPatch } from "@/lib/api-client";
import type { LeadListItem } from "@/services/leads-service";

/**
 * Kanban board data (KAN-02.1 API → KAN-02.2 UI). The board summary gives each
 * stage's lead count and combined value for the selected pipeline; the columns
 * load their own cards through the shared list fetch (`fetchLeads`), scoped by
 * `status` + `pipeline`, so the two never drift.
 */

/** One stage's rollup, as `GET /leads/board` returns it. */
export interface BoardStageSummary {
  stage: string;
  count: number;
  /** DECIMAL server-side; kept a string so summing never rounds (matches the list). */
  totalValue: string;
}

export interface LeadBoardResponse {
  pipeline: string;
  stages: BoardStageSummary[];
  totals: { count: number; totalValue: string };
}

/**
 * The board Workpex opens on. Until a pipeline/stage schema exists (KAN-01.1
 * deferred, ADR-0017) every lead carries this one pipeline; the switcher arrives
 * with KAN-06.1.
 */
export const DEFAULT_PIPELINE = "Lead Pipeline";

/** Fetches the per-stage count + value rollup for a pipeline (KAN-02.1 AC1/AC2). */
export async function fetchBoard(
  pipeline: string,
  signal?: AbortSignal,
): Promise<LeadBoardResponse> {
  const params = new URLSearchParams({ pipeline });
  return apiGet<LeadBoardResponse>("/leads/board", params, signal);
}

/** What a stage move returns: the updated lead and the recounted affected columns. */
export interface MoveLeadStageResponse {
  lead: LeadListItem;
  pipeline: string;
  /** Source + target stages, recounted server-side (KAN-04.1 AC3). */
  stages: BoardStageSummary[];
}

/**
 * Moves one lead to a new stage (KAN-04.1 → KAN-04.2 drag). Writes the shared
 * `status` field — the same field the list badge and the drawer edit — and returns
 * the recounted source/target columns so the board refreshes those two without a
 * reload. A rejected move throws an `ApiError` (400 invalid stage, 404 out of
 * scope) the caller rolls back on.
 */
export async function patchLeadStage(
  leadId: string,
  stage: string,
  signal?: AbortSignal,
): Promise<MoveLeadStageResponse> {
  return apiPatch<MoveLeadStageResponse>(
    `/leads/${leadId}/stage`,
    { stage },
    signal,
  );
}
