import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * The Tags catalogue client (Settings → Sales & CRM Configuration → Tags).
 *
 * Unlike the Category and Lead Source catalogues, a tag is referenced by **id**: leads
 * link to it through `LeadTag` (LEAD-12.1). So a rename needs no cascade — every lead
 * keeps its link — and a delete is a soft delete server-side, because the join cascades
 * and a row delete would strip the tag off every lead carrying it (ADR-0063).
 */

/** One tag as `GET /api/tags` returns it — the reference table's four columns. */
export interface TagNode {
  id: string;
  name: string;
  isActive: boolean;
  /** Leads carrying this tag, aggregated server-side. */
  leadCount: number;
}

export interface CreateTagInput {
  name: string;
  isActive?: boolean;
}

export interface UpdateTagInput {
  name?: string;
  isActive?: boolean;
}

export function fetchTags(signal?: AbortSignal): Promise<TagNode[]> {
  return apiGet<TagNode[]>("/tags", undefined, signal);
}

export function createTag(input: CreateTagInput): Promise<TagNode> {
  return apiPost<TagNode>("/tags", input);
}

export function updateTag(id: string, input: UpdateTagInput): Promise<TagNode> {
  return apiPatch<TagNode>(`/tags/${id}`, input);
}

/** Retires a tag. The leads carrying it keep their link and their other tags. */
export function deleteTag(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/tags/${id}`);
}
