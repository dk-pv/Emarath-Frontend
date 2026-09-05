import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * The lead source catalogue client (Settings → Sales & CRM Configuration → Lead Source).
 *
 * The same name-as-value contract the Category catalogue holds: a source's `name` IS the
 * value a lead stores in `Lead.source`, so renaming one here cascades to its leads
 * server-side and deleting one is refused while any lead still carries it. The New Lead
 * form's Source dropdown reads the same table through `GET /api/lookups/sources`, so the
 * options offered there and the rows managed here cannot drift.
 */

/** One lead source as `GET /api/lead-sources` returns it — the reference table's columns. */
export interface LeadSourceNode {
  id: string;
  name: string;
  isActive: boolean;
  /** Live leads carrying this source's name — what blocks a delete. */
  leadCount: number;
  createdByName: string | null;
  createdAt: string;
}

export interface CreateLeadSourceInput {
  name: string;
  isActive?: boolean;
}

export interface UpdateLeadSourceInput {
  name?: string;
  isActive?: boolean;
}

export function fetchLeadSources(
  signal?: AbortSignal,
): Promise<LeadSourceNode[]> {
  return apiGet<LeadSourceNode[]>("/lead-sources", undefined, signal);
}

export function createLeadSource(
  input: CreateLeadSourceInput,
): Promise<LeadSourceNode> {
  return apiPost<LeadSourceNode>("/lead-sources", input);
}

export function updateLeadSource(
  id: string,
  input: UpdateLeadSourceInput,
): Promise<LeadSourceNode> {
  return apiPatch<LeadSourceNode>(`/lead-sources/${id}`, input);
}

/** Deletes a source; the API refuses one that still holds leads. */
export function deleteLeadSource(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/lead-sources/${id}`);
}
