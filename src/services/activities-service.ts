import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { LeadListItem } from "@/services/leads-service";

/** The worklist tabs (ACT-02.1). */
export const ACTIVITY_BUCKETS = [
  "overdue",
  "today",
  "tomorrow",
  "completed",
  "all",
] as const;

export type ActivityBucket = (typeof ACTIVITY_BUCKETS)[number];

export type ActivityType = "CALL" | "MEETING" | "TASK";

/** The filter popup's quick-date checkboxes (mirrors the backend's window list). */
export const ACTIVITY_DATE_WINDOWS = [
  "overdue",
  "today",
  "tomorrow",
  "yesterday",
  "thisWeek",
  "thisMonth",
] as const;

export type ActivityDateWindow = (typeof ACTIVITY_DATE_WINDOWS)[number];

/**
 * One activity as the list endpoint returns it (ACT-02.1). Declared next to the
 * fetch, mirroring the backend DTO — the same convention `LeadListItem` follows;
 * a generated shared type replaces both later. Each row carries its linked lead's
 * list columns (`lead`), so the Activities table reuses the Leads renderers.
 */
export interface ActivityListItem {
  id: string;
  type: ActivityType;
  title: string;
  description: string | null;
  dueAt: string;
  endAt: string | null;
  completedAt: string | null;
  locationId: string | null;
  assignees: { id: string; name: string }[];
  lead: LeadListItem;
}

/** The tab badge counts, identical across buckets (they are totals, not per-page). */
export type ActivityBucketCounts = Record<ActivityBucket, number>;

export interface ActivityListResult {
  rows: ActivityListItem[];
  total: number;
  counts: ActivityBucketCounts;
}

/**
 * What the Activities list endpoint receives. The three day boundaries are the
 * instants of the client's own local midnight/tomorrow/day-after (ADR-0028 §3),
 * so "today" is the user's day; the server compares `dueAt` against them.
 */
export interface ActivitiesQuery {
  bucket: ActivityBucket;
  page: number;
  size: number;
  todayStart: string;
  todayEnd: string;
  tomorrowEnd: string;
  /** Free-text over customer name + activity title (ACT-07.1 AC1). */
  search?: string;
  /** Assignee / lead-status / lead-pipeline filters (ACT-07.1 AC2). */
  assignedAgent?: readonly string[];
  status?: readonly string[];
  pipeline?: readonly string[];
  /** The filter popup's ticked quick-date checkboxes; their windows OR together. */
  dateWindow?: readonly ActivityDateWindow[];
  /**
   * Edges for the windows the three tab boundaries don't already cover. Computed in
   * the client's timezone like those, and sent only when their checkbox is ticked.
   */
  yesterdayStart?: string;
  weekStart?: string;
  weekEnd?: string;
  monthStart?: string;
  monthEnd?: string;
  /** The popup's explicit From/To due-date range. */
  dueFrom?: string;
  dueTo?: string;
  /** Follow-up type — the popup's "All Activities" dropdown. */
  type?: readonly ActivityType[];
}

/** Fetches one scoped worklist page for the active tab (ACT-02.1 + ACT-07.1). */
export async function fetchActivities(
  query: ActivitiesQuery,
  signal?: AbortSignal,
): Promise<ActivityListResult> {
  const params = new URLSearchParams({
    bucket: query.bucket,
    page: String(query.page),
    size: String(query.size),
    todayStart: query.todayStart,
    todayEnd: query.todayEnd,
    tomorrowEnd: query.tomorrowEnd,
  });
  if (query.search) params.set("search", query.search);
  // Repeated params per value, matching the Leads list convention (`?status=A&status=B`).
  for (const id of query.assignedAgent ?? [])
    params.append("assignedAgent", id);
  for (const value of query.status ?? []) params.append("status", value);
  for (const value of query.pipeline ?? []) params.append("pipeline", value);
  for (const value of query.dateWindow ?? [])
    params.append("dateWindow", value);
  for (const value of query.type ?? []) params.append("type", value);
  // Only the edges the ticked windows actually need, so an unticked window sends
  // nothing and the URL stays as short as the filter selection is.
  for (const key of [
    "yesterdayStart",
    "weekStart",
    "weekEnd",
    "monthStart",
    "monthEnd",
    "dueFrom",
    "dueTo",
  ] as const) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  return apiGet<ActivityListResult>("/activities", params, signal);
}

/**
 * The Add New Follow-up payload (ACT-03.2), mirroring the backend `CreateActivityDto`.
 * `leadId` is the lead the drawer was opened on; a Call carries no `endAt`/`locationId`
 * (the service rejects them). The client composes Due Date + Start Time into `dueAt`.
 */
export interface CreateActivityInput {
  type: ActivityType;
  leadId: string;
  description: string;
  dueAt: string;
  endAt?: string;
  locationId?: string;
  assigneeIds: string[];
}

/** Creates a follow-up on a lead (ACT-03.1 API). Returns the created id. */
export async function createActivity(
  input: CreateActivityInput,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return apiPost<{ id: string }>("/activities", input, signal);
}

/**
 * Marks a follow-up complete (ACT-04.1). Idempotent server-side. Only the fields
 * the caller reconciles are typed here — the list is refetched for the rest.
 */
export async function completeActivity(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string; completedAt: string | null }> {
  return apiPatch<{ id: string; completedAt: string | null }>(
    `/activities/${id}/complete`,
    undefined,
    signal,
  );
}

/** The editable fields of a follow-up (ACT-05.1), mirroring `UpdateActivityDto`. */
export interface UpdateActivityInput {
  type: ActivityType;
  description: string;
  dueAt: string;
  endAt?: string;
  locationId?: string;
  assigneeIds: string[];
}

/** Edits a follow-up (ACT-05.1). The optimistic row comes from the form. */
export async function updateActivity(
  id: string,
  input: UpdateActivityInput,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return apiPatch<{ id: string }>(`/activities/${id}`, input, signal);
}

/** Soft-deletes a follow-up (ACT-06.1). Idempotent server-side; returns the id. */
export async function deleteActivity(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/activities/${id}`, signal);
}
