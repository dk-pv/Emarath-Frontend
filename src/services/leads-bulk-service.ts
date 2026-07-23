import { apiPost } from "@/lib/api-client";

/** Mirrors the LEAD-09.1 backend contract; a generated API type replaces it later. */
export interface BulkItemResult {
  id: string;
  status: "success" | "failed";
  reason?: string;
}

export interface BulkActionResponse {
  results: BulkItemResult[];
  summary: { total: number; success: number; failed: number };
}

/** Reassign the selected leads to one agent (LEAD-09.1 `/leads/bulk/reassign`). */
export function reassignLeads(
  ids: readonly string[],
  agentId: string,
  signal?: AbortSignal,
): Promise<BulkActionResponse> {
  return apiPost<BulkActionResponse>(
    "/leads/bulk/reassign",
    { ids, agentId },
    signal,
  );
}

/** Permanently delete the selected leads (LEAD-09.1 `/leads/bulk/delete`). */
export function deleteLeads(
  ids: readonly string[],
  signal?: AbortSignal,
): Promise<BulkActionResponse> {
  return apiPost<BulkActionResponse>("/leads/bulk/delete", { ids }, signal);
}
