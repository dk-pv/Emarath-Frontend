import { apiDelete, apiPost } from "@/lib/api-client";
import type { LeadListItem } from "@/services/leads-service";

/**
 * Per-lead tag mutations (LEAD-12.1), wired to the `/leads/:id/tags` API.
 *
 * Tags are applied from the existing catalogue (`GET /lookups/tags`), never
 * created here — creating tags is FND-04.2's reference-data concern. Each call
 * returns the updated lead so the row can refresh its chips in place (AC3).
 */

/** Apply one existing tag to a lead (AC1) — returns the updated lead. */
export function addLeadTag(
  id: string,
  tagId: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPost<LeadListItem>(`/leads/${id}/tags`, { tagId }, signal);
}

/** Remove one tag from a lead (AC2) — returns the updated lead. */
export function removeLeadTag(
  id: string,
  tagId: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiDelete<LeadListItem>(`/leads/${id}/tags/${tagId}`, signal);
}
