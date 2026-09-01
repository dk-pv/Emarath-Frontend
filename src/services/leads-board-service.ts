import { apiGet, apiPatch } from "@/lib/api-client";
import {
  appendLeadFilterParams,
  type LeadListItem,
} from "@/services/leads-service";
import type { FilterCondition } from "@/types";

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

/**
 * The board toolbar's search + field/quick filters (KAN-07.1). Sort is deliberately
 * absent: it orders a column's cards, never the rollup a groupBy already orders.
 */
export interface BoardFilterQuery {
  search?: string;
  conditions: readonly FilterCondition[];
  /**
   * The advanced filter builder's payload (ADR-0039/0052), as the JSON `conditions`
   * param. Named apart from the simple `conditions` above — which are the toolbar's
   * field/quick-filter values — because both ride the same request.
   */
  advancedConditions?: string;
}

/**
 * Fetches the per-stage count + value rollup for a pipeline (KAN-02.1 AC1/AC2),
 * narrowed by the board toolbar's search and filters (KAN-07.1 AC1/AC5). The
 * search/filter params are appended with the very same `appendLeadFilterParams`
 * the list fetch uses, so the rollup and the cards can never encode a filter
 * differently. `pipeline` is sent explicitly and is never a user condition.
 */
export async function fetchBoard(
  pipeline: string,
  query?: BoardFilterQuery,
  signal?: AbortSignal,
): Promise<LeadBoardResponse> {
  const params = new URLSearchParams({ pipeline });
  if (query) {
    // No sort/page for a rollup — pass only the where-shaping params through.
    appendLeadFilterParams(params, {
      page: 1,
      size: 1,
      search: query.search,
      filters: query.conditions,
      conditions: query.advancedConditions,
    });
  }
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
  /** Why the lead was lost — sent only for a move into LOST; the server clears it otherwise. */
  lostReason?: string,
  signal?: AbortSignal,
): Promise<MoveLeadStageResponse> {
  return apiPatch<MoveLeadStageResponse>(
    `/leads/${leadId}/stage`,
    lostReason ? { stage, lostReason } : { stage },
    signal,
  );
}
