import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * The stage catalogue client (KAN-05.1 API → KAN-05.2 consumption + management).
 * The single authoritative source of the stage set, colours and order — the board
 * columns, the list status badge and the status dropdown all read it, so the frontend
 * carries no copy — and the only write path (add/rename/recolour/reorder/delete).
 */

/** One stage, as `GET /stages` returns it. */
export interface Stage {
  id: string;
  pipeline: string;
  name: string;
  /** Palette key (`violet`, `amber`, …); the frontend maps it to Tailwind classes. */
  color: string;
  position: number;
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
export async function createStage(input: {
  pipeline: string;
  name: string;
  color: string;
}): Promise<Stage> {
  return apiPost<Stage>("/stages", input);
}

/** Renames and/or recolours a stage (KAN-05.2 AC2). */
export async function updateStage(
  id: string,
  input: { name?: string; color?: string },
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
