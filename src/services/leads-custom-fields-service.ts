import { apiDelete, apiGet, apiPost } from "@/lib/api-client";

/** The five custom-column field types (LEAD-05.1), mirroring the backend enum. */
export type LeadCustomFieldType =
  "TEXT" | "TEXTBOX" | "NUMBER" | "DATE" | "DATETIME";

/**
 * A user-defined custom column (LEAD-05.1), mirroring the backend `LeadCustomFieldDto`.
 * `key` is the stable "cf_<slug>" id used both as the table column key and inside the
 * per-user Manage Columns layout; `position` is the default left-to-right order.
 */
export interface LeadCustomField {
  id: string;
  key: string;
  name: string;
  type: LeadCustomFieldType;
  position: number;
}

/** The active custom columns in display order (`GET /api/lead-custom-fields`). */
export function fetchLeadCustomFields(
  signal?: AbortSignal,
): Promise<LeadCustomField[]> {
  return apiGet<LeadCustomField[]>("/lead-custom-fields", undefined, signal);
}

/** Creates a custom column from a name + type (`POST /api/lead-custom-fields`). */
export function createLeadCustomField(
  input: { name: string; type: LeadCustomFieldType },
  signal?: AbortSignal,
): Promise<LeadCustomField> {
  return apiPost<LeadCustomField>("/lead-custom-fields", input, signal);
}

/** Soft-deletes a custom column (`DELETE /api/lead-custom-fields/:id`). */
export async function deleteLeadCustomField(
  id: string,
  signal?: AbortSignal,
): Promise<void> {
  await apiDelete<{ id: string }>(`/lead-custom-fields/${id}`, signal);
}
