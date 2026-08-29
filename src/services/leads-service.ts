import { apiGet, apiPost, apiPut } from "@/lib/api-client";
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
  // Activity Quick Filter presets (LEAD-04.1): a bucket flag plus the client's
  // day-boundary instants.
  "todaysFollowUps",
  "overdue",
  "noActivity",
  "todayStart",
  "todayEnd",
  "tomorrowEnd",
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
  email: string | null;
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
  /** Address parts the board card joins into its one location line (KAN-03.1). */
  state: string | null;
  street: string | null;
  city: string | null;
  assignedAgents: { id: string; name: string }[];
  tags: { id: string; name: string }[];
  /**
   * Custom-column values keyed by the field's stable "cf_<slug>" key (LEAD-05.1).
   * Only fields with a value appear; a custom column reads `row.customFields[key]`.
   */
  customFields: Record<string, string>;
  /** Whether the current user has pinned this lead (ADR-0031) — personal, floats it to the top. */
  isPinned: boolean;
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
 * Fetches one scoped lead for the Lead Detail page (`GET /api/leads/:id`).
 * Throws `ApiError` with status 404 for an out-of-scope, missing or deleted lead,
 * which the page renders as its graceful not-found state.
 */
export function fetchLead(
  id: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiGet<LeadListItem>(`/leads/${id}`, undefined, signal);
}

export type LeadActivityType = "CALL" | "MEETING" | "TASK";

/**
 * One entry in the Lead Detail drawer's timeline. The `created`/`assigned`/`note`
 * variants mirror the backend `GET /leads/:id/timeline` (partial-but-honest — no
 * "email sent" and no actor for create/assign). The two `followup-*` variants are
 * derived on the client from `GET /leads/:id/activities` and merged in, so a
 * created/completed follow-up shows on the timeline without a new backend feed.
 * The follow-up actor is not recorded either, so it is deliberately absent.
 */
export type LeadTimelineEvent =
  | { id: string; type: "created"; at: string }
  | { id: string; type: "assigned"; at: string; assigneeName: string }
  | { id: string; type: "note"; at: string; authorName: string; body: string }
  | {
      id: string;
      type: "followup-created";
      at: string;
      activityType: LeadActivityType;
      dueAt: string;
      description: string | null;
    }
  | {
      id: string;
      type: "followup-completed";
      at: string;
      activityType: LeadActivityType;
      dueAt: string;
      description: string | null;
    };

/** The Lead Detail timeline for one lead (newest first), scoped server-side. */
export function fetchLeadTimeline(
  id: string,
  signal?: AbortSignal,
): Promise<LeadTimelineEvent[]> {
  return apiGet<LeadTimelineEvent[]>(
    `/leads/${id}/timeline`,
    undefined,
    signal,
  );
}

/**
 * One of a lead's follow-ups (ACT-03.2 / ACT-04.1), mirroring the backend
 * `LeadActivity`. The drawer derives its Next Follow-up card (earliest incomplete)
 * and its Follow-up Created/Completed timeline entries from these.
 */
export interface LeadActivity {
  id: string;
  type: LeadActivityType;
  description: string | null;
  dueAt: string;
  endAt: string | null;
  completedAt: string | null;
  createdAt: string;
  assignees: { id: string; name: string }[];
}

/** The Lead Detail drawer's follow-ups for one lead (earliest due first), scoped. */
export function fetchLeadActivities(
  id: string,
  signal?: AbortSignal,
): Promise<LeadActivity[]> {
  return apiGet<LeadActivity[]>(`/leads/${id}/activities`, undefined, signal);
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

  // The advanced filter builder's conditions (ADR-0039) ride as one JSON param, so
  // the list fetch and the export request the identical filtered view.
  if (query.conditions) {
    params.set("conditions", query.conditions);
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
 * attempts are numbers; ids are the values chosen from the lookups. Verified against
 * Workpex, only Name and Primary Phone are required (Status/Pipeline default server-side);
 * every other field is optional.
 */
export interface CreateLeadInput {
  name: string;
  primaryPhone: string;
  firstName?: string;
  secondaryPhone?: string;
  email?: string;
  assignedAgentIds?: string[];
  status?: string;
  pipeline?: string;
  tagIds?: string[];
  complaintReason?: string;
  product?: string;
  productQty?: string;
  product2?: string;
  product2Qty?: string;
  language?: string;
  source?: string;
  callStatus?: string;
  callAttempts?: number;
  msgAttempts?: number;
  country?: string;
  state?: string;
  street?: string;
  city?: string;
  nationalCode?: string;
  bookingDate?: string;
  category?: string;
  actualAmount?: string;
  forecastedAmount?: string;
  paymentMethod?: string;
  /** Per-lead custom-column values (LEAD-05.1). Blank fields are omitted. */
  customFields?: { fieldId: string; value: string }[];
}

/** Creates a lead (LEAD-06.1). Returns the created row for the list to adopt. */
export async function createLead(
  input: CreateLeadInput,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPost<LeadListItem>("/leads", input, signal);
}

/**
 * The full editable record that prefills the Edit Lead form (`GET /api/leads/:id/edit`).
 * A superset of the list row — it carries the fields the list never shows (products,
 * address, payment, the raw complaint) — mirroring the backend `LeadEditData`. Amounts
 * and quantities stay strings (Decimal precision); `msgAttempts` is the lead's WhatsApp
 * attempts. Assigned agents carry names so the picker can label a chip for an assignee
 * outside the assignable list. Throws `ApiError` 404 for an out-of-scope/missing lead.
 */
export interface LeadEditData {
  id: string;
  name: string;
  firstName: string | null;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string | null;
  language: string | null;
  country: string | null;
  source: string | null;
  status: string;
  pipeline: string;
  product: string | null;
  productQty: string | null;
  product2: string | null;
  product2Qty: string | null;
  bookingDate: string | null;
  category: string | null;
  actualAmount: string | null;
  forecastedAmount: string | null;
  paymentMethod: string | null;
  state: string | null;
  street: string | null;
  city: string | null;
  nationalCode: string | null;
  callStatus: string | null;
  callAttempts: number;
  msgAttempts: number;
  assignedAgents: { id: string; name: string }[];
  tagIds: string[];
  complaintReason: string | null;
  /** Custom values keyed by field key (LEAD-05.1), so Edit prefills them. */
  customFields: Record<string, string>;
}

/** Fetches one scoped lead's full editable data to prefill the Edit Lead form. */
export function fetchLeadForEdit(
  id: string,
  signal?: AbortSignal,
): Promise<LeadEditData> {
  return apiGet<LeadEditData>(`/leads/${id}/edit`, undefined, signal);
}

/**
 * Updates a lead (LEAD-06 edit mode) via `PUT /api/leads/:id`. The Edit form submits
 * every field, so the payload is the same `CreateLeadInput` shape as create — a full
 * replace. Returns the updated row for the list to adopt in place.
 */
export async function updateLead(
  id: string,
  input: CreateLeadInput,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPut<LeadListItem>(`/leads/${id}`, input, signal);
}
