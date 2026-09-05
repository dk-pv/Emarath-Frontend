import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * Settings → Communication → Templates.
 *
 * A real resource at `/api/message-templates`, not a settings row: the list is searched,
 * filtered and paged in the query (ADR-0068). Every mutation returns the row it wrote, and
 * the screen refetches the page afterwards so the total and the ordering stay the
 * server's.
 */
export const TEMPLATE_TYPES = ["EMAIL", "WHATSAPP"] as const;
export type MessageTemplateType = (typeof TEMPLATE_TYPES)[number];

export const TEMPLATE_STATUSES = ["ACTIVE", "VERIFICATION_PENDING"] as const;
export type MessageTemplateStatus = (typeof TEMPLATE_STATUSES)[number];

/** The reference's type filter: the two types, plus "everything". */
export const TEMPLATE_FILTERS = [
  { value: "ALL", label: "All templates" },
  { value: "EMAIL", label: "Email templates" },
  { value: "WHATSAPP", label: "Whatsapp templates" },
] as const;
export type TemplateFilter = (typeof TEMPLATE_FILTERS)[number]["value"];

/** The reference's dropdown inside the modal, which offers only the two real types. */
export const TEMPLATE_TYPE_OPTIONS = [
  { value: "EMAIL", label: "Email" },
  { value: "WHATSAPP", label: "Whatsapp" },
] as const;

/** The reference's footer opens on "05". */
export const TEMPLATE_PAGE_SIZES = [5, 10, 25] as const;
export const DEFAULT_TEMPLATE_PAGE_SIZE = 5;

export interface MessageTemplate {
  id: string;
  name: string;
  type: MessageTemplateType;
  content: string;
  status: MessageTemplateStatus;
  /** Always null: no attachment store is wired to templates yet (ADR-0068). */
  attachments: null;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MessageTemplateList {
  rows: MessageTemplate[];
  total: number;
}

export interface TemplateQuery {
  search: string;
  filter: TemplateFilter;
  page: number;
  size: number;
}

export interface TemplateInput {
  name: string;
  type: MessageTemplateType;
  content: string;
  isActive: boolean;
}

export function fetchMessageTemplates(
  query: TemplateQuery,
  signal?: AbortSignal,
): Promise<MessageTemplateList> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.search.trim() !== "") params.set("search", query.search.trim());
  // "All templates" is the absence of the filter, not a third type.
  if (query.filter !== "ALL") params.set("type", query.filter);

  return apiGet<MessageTemplateList>("/message-templates", params, signal);
}

export function createMessageTemplate(
  input: TemplateInput,
): Promise<MessageTemplate> {
  return apiPost<MessageTemplate>("/message-templates", input);
}

export function updateMessageTemplate(
  id: string,
  input: TemplateInput,
): Promise<MessageTemplate> {
  return apiPatch<MessageTemplate>(`/message-templates/${id}`, input);
}

export function deleteMessageTemplate(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/message-templates/${id}`);
}
