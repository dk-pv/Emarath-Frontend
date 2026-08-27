import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * The caller's saved filter presets (ADR-0052) — the checkbox row above the condition
 * builder on both the Leads list and the Kanban board.
 *
 * `conditions` is the same JSON payload the builder produces (`buildConditionsPayload`)
 * and the list/board send as `?conditions=`, so applying a preset is a hand-off, never
 * a re-encode. One shared resource, so a preset saved on the list is offered on the
 * board (KAN-07.1 AC5).
 */
export interface SavedFilter {
  id: string;
  name: string;
  /** JSON array of `{ field, operator, values }`, ready for the query param. */
  conditions: string;
  createdAt: string;
  updatedAt: string;
}

export function fetchSavedFilters(
  signal?: AbortSignal,
): Promise<SavedFilter[]> {
  return apiGet<SavedFilter[]>("/saved-filters", undefined, signal);
}

/** "Save & Filter" — store the current conditions under a new name. */
export function createSavedFilter(
  name: string,
  conditions: string,
  signal?: AbortSignal,
): Promise<SavedFilter> {
  return apiPost<SavedFilter>("/saved-filters", { name, conditions }, signal);
}

/** "Update & Filter" — overwrite the selected preset's conditions, keeping its name. */
export function updateSavedFilter(
  id: string,
  changes: { name?: string; conditions?: string },
  signal?: AbortSignal,
): Promise<SavedFilter> {
  return apiPatch<SavedFilter>(`/saved-filters/${id}`, changes, signal);
}

export function deleteSavedFilter(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/saved-filters/${id}`, signal);
}
