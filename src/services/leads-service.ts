import { apiGet, apiPost } from "@/lib/api-client";
import type { FilterCondition, ListQuery, ListResult } from "@/types";

/** Multi-value field filters (LEAD-03.2, LEAD-12.1): repeated in the query string. */
const MULTI_PARAM_KEYS = new Set(["source", "status", "assignedAgent", "tag"]);

/**
 * Single-value params: the Quick Filter presets (LEAD-04.1 — a date window or a
 * one-shot flag) and the Kanban pipeline scope (KAN-02.2), each an exact match.
 */
const SINGLE_PARAM_KEYS = new Set([
  "createdFrom",
  "createdTo",
  "unassigned",
  "archived",
  "pipeline",
]);

/**
 * One lead as the list endpoint returns it (LEAD-02.1).
 *
 * Deliberately declared here, next to the fetch, rather than in a shared types
 * file: the backend DTO is the source of truth, and a hand-copied mirror in a
 * global module would drift from it silently. A generated/shared API type
 * replaces this later. Amounts stay strings — they are DECIMAL server-side, and
 * a JSON number is a double, which would reintroduce the rounding the column
 * exists to prevent.
 */
export interface LeadListItem {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  language: string | null;
  country: string | null;
  source: string | null;
  status: string;
  pipeline: string;
  category: string | null;
  actualAmount: string | null;
  forecastedAmount: string | null;
  bookingDate: string | null;
  callStatus: string | null;
  callAttempts: number;
  whatsappAttempts: number;
  createdAt: string;
  assignedAgents: { id: string; name: string }[];
  tags: { id: string; name: string }[];
}

/**
 * Fetches one scoped page of leads.
 *
 * Matches the `ListSource` shape the shared table framework expects, so the same
 * table that ran against an in-memory source in Foundation now runs against the
 * real API with nothing else changed. The backend takes sort and direction as
 * separate parameters, so the frontend's `SortState` is split apart here; when
 * no sort is set the parameters are omitted and the API applies its own default
 * (newest first), which is the Workpex default order.
 */
export async function fetchLeads(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<ListResult<LeadListItem>> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  appendLeadFilterParams(params, query);

  return apiGet<ListResult<LeadListItem>>("/leads", params, signal);
}

/**
 * Writes the sort, search and filter params a Leads query carries onto a
 * `URLSearchParams` — everything except paging. Shared by the list fetch and the
 * export URL (LEAD-08.1) so a file requests the identical view the list shows;
 * duplicating this mapping is exactly how the two would silently drift.
 */
export function appendLeadFilterParams(
  params: URLSearchParams,
  query: ListQuery,
): void {
  if (query.sort) {
    params.set("sort", query.sort.key);
    params.set("direction", query.sort.direction);
  }

  // Server-side search over name and phone (LEAD-03.1). The trimmed guard keeps
  // an empty box from sending `search=`, which would be a redundant parameter;
  // the backend also treats blank as no search.
  if (query.search?.trim()) {
    params.set("search", query.search.trim());
  }

  // Field filters (LEAD-03.2/03.3) are repeated params matched with IN; Quick
  // Filter presets (LEAD-04.1) contribute single-value params (a createdAt window,
  // or an unassigned/archived flag) through the very same condition pipeline.
  for (const condition of query.filters ?? []) {
    const values = filterValues(condition);
    if (MULTI_PARAM_KEYS.has(condition.key)) {
      for (const value of values) params.append(condition.key, value);
    } else if (SINGLE_PARAM_KEYS.has(condition.key) && values[0]) {
      params.set(condition.key, values[0]);
    }
  }
}

/** Normalises a condition's value to the string values the API expects. */
function filterValues(condition: FilterCondition): string[] {
  const { value } = condition;
  if (Array.isArray(value)) return value.map(String);
  if (value === null || value === "") return [];
  return [String(value)];
}

/** The values the filter panel offers per field (LEAD-03.3), scoped by role. */
export interface LeadFilterOptions {
  sources: string[];
  statuses: string[];
  agents: { id: string; name: string }[];
  /** Tags present on the caller's scoped leads (LEAD-12.1 AC4). */
  tags: { id: string; name: string }[];
}

/** Fetches the scoped Source/Status/Assigned Agent options for the filter panel. */
export async function fetchLeadFilterOptions(
  signal?: AbortSignal,
): Promise<LeadFilterOptions> {
  return apiGet<LeadFilterOptions>("/leads/filter-options", undefined, signal);
}

/**
 * The New Lead form's payload (LEAD-06.2), mirroring the backend `CreateLeadDto`.
 * Amounts and quantities are strings so the Decimal precision survives the wire;
 * attempts are numbers; ids are the values chosen from the lookups.
 */
export interface CreateLeadInput {
  name: string;
  primaryPhone: string;
  firstName?: string;
  secondaryPhone?: string;
  assignedAgentIds?: string[];
  status?: string;
  pipeline?: string;
  tagIds?: string[];
  complaintReason?: string;
  product: string;
  productQty?: string;
  product2?: string;
  product2Qty?: string;
  language: string;
  source?: string;
  callStatus: string;
  callAttempts: number;
  msgAttempts?: number;
  country: string;
  state?: string;
  street?: string;
  city?: string;
  nationalCode?: string;
  bookingDate?: string;
  category?: string;
  actualAmount: string;
  forecastedAmount?: string;
  paymentMethod: string;
}

/** Creates a lead (LEAD-06.1). Returns the created row for the list to adopt. */
export async function createLead(
  input: CreateLeadInput,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPost<LeadListItem>("/leads", input, signal);
}
