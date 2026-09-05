import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * The stage catalogue client (KAN-05.1 API → KAN-05.2 consumption + management).
 * The single authoritative source of the stage set, colours and order — the board
 * columns, the list status badge and the status dropdown all read it, so the frontend
 * carries no copy — and the only write path (add/rename/recolour/reorder/delete).
 */

/**
 * The wizard's stage vocabulary, mirroring `stage.constants.ts` on the backend so the
 * offered options and the accepted values cannot drift. Both lists come from captures of
 * the selects' open panels (ADR-0060).
 */
export const STAGE_INCLUSIONS = [
  { value: "INCLUDE_IN_SALES_PIPELINE", label: "Include In Sales Pipeline" },
  { value: "EXCLUDE_FROM_SALES_PIPELINE", label: "Exclude From Sales Pipeline" },
] as const;

/** A closed stage's outcome. */
export const STAGE_OUTCOMES = [
  { value: "WON", label: "Won" },
  { value: "LOST", label: "Lost" },
  { value: "IGNORE", label: "Ignore" },
] as const;

export const MIN_STAGE_PROBABILITY = 0;
export const MAX_STAGE_PROBABILITY = 100;

/** One stage, as `GET /stages` returns it. */
export interface Stage {
  id: string;
  pipeline: string;
  name: string;
  /** Palette key (`violet`, `amber`, …); the frontend maps it to Tailwind classes. */
  color: string;
  position: number;
  /** Which panel of the Sales Pipeline wizard the stage belongs to. */
  isClosed: boolean;
  /** `WON` / `LOST` on a closed stage; null on an open one. */
  outcome: string | null;
  inclusion: string;
  probability: number;
  requireFollowUp: boolean;
}

/** The wizard's stage fields. Omitted keys leave the stored value untouched. */
export interface StageWizardFields {
  isClosed?: boolean;
  outcome?: string | null;
  inclusion?: string;
  probability?: number;
  requireFollowUp?: boolean;
}

/** Fetches a pipeline's stages in display order. */
export async function fetchStages(
  pipeline: string,
  signal?: AbortSignal,
): Promise<Stage[]> {
  const params = new URLSearchParams({ pipeline });
  return apiGet<Stage[]>("/stages", params, signal);
}

/** Adds a stage to a pipeline (KAN-05.2 AC1). Appended after the last stage. */
export async function createStage(
  input: { pipeline: string; name: string; color: string } & StageWizardFields,
): Promise<Stage> {
  return apiPost<Stage>("/stages", input);
}

/** Renames and/or recolours a stage (KAN-05.2 AC2). */
export async function updateStage(
  id: string,
  input: { name?: string; color?: string } & StageWizardFields,
): Promise<Stage> {
  return apiPatch<Stage>(`/stages/${id}`, input);
}

/** Persists a new stage order for a pipeline (KAN-05.2 AC2). */
export async function reorderStages(
  pipeline: string,
  orderedIds: string[],
): Promise<Stage[]> {
  return apiPatch<Stage[]>("/stages/reorder", { pipeline, orderedIds });
}

/** Deletes a stage; the API refuses one that still holds leads (KAN-05.2 AC2). */
export async function deleteStage(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/stages/${id}`);
}
