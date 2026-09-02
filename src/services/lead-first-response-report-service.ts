import { apiGet } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { ListResult, SortState } from "@/types";

/** The five metric cards, mirroring `LeadFirstResponseKpis`. */
export interface LeadFirstResponseKpis {
  totalLeads: number;
  contacted: number;
  contactRate: number;
  /** Mean minutes to first engagement across contacted leads; null when none. */
  avgFirstResponseMinutes: number | null;
  untouched: number;
  untouchedRate: number;
  respondedLate: number;
  lateRate: number;
}

export interface LeadFirstResponseAgentRef {
  id: string;
  name: string;
}

/** One row of the Lead Records table, mirroring `LeadFirstResponseRow`. */
export interface LeadFirstResponseRow {
  id: string;
  name: string;
  assignedTo: LeadFirstResponseAgentRef[];
  source: string | null;
  createdAt: string;
  firstActivityAt: string | null;
  activityType: string | null;
  firstResponseMinutes: number | null;
  followUpAt: string | null;
}

export interface LeadFirstResponseSummary {
  kpis: LeadFirstResponseKpis;
  tabs: { all: number; contacted: number; untouched: number };
}

/** Which records tab is active. */
export type ContactFilter = "all" | "contacted" | "untouched";

/**
 * The activity kinds the toolbar filter offers, in the reference's own vocabulary. Each
 * maps to a record Emarath keeps against a lead; "Email" is absent because nothing in the
 * model records a sent email.
 */
export const ACTIVITY_TYPES: readonly { value: string; label: string }[] = [
  { value: "CALL", label: "Call" },
  { value: "NOTE", label: "Note Added" },
  { value: "FOLLOW_UP", label: "Follow-up" },
  { value: "STATUS_CHANGED", label: "Status Changed" },
  { value: "LEAD_EDITED", label: "Lead Edited" },
];

/** The report's shipped "responded late" bound, in hours. */
export const DEFAULT_LATE_HOURS = 24;

export interface LeadFirstResponseFilters {
  search?: string;
  from?: string;
  to?: string;
  agent?: string[];
  source?: string[];
  activityType?: string[];
  contact?: ContactFilter;
  lateHours: number;
}

function appendFilters(
  params: URLSearchParams,
  filters: LeadFirstResponseFilters,
): void {
  params.set("lateHours", String(filters.lateHours));
  if (filters.search) params.set("search", filters.search);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.contact && filters.contact !== "all")
    params.set("contact", filters.contact);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const source of filters.source ?? []) params.append("source", source);
  for (const type of filters.activityType ?? [])
    params.append("activityType", type);
}

/** The metric cards and the records tabs' counts. */
export function fetchLeadFirstResponseSummary(
  filters: LeadFirstResponseFilters,
  signal?: AbortSignal,
): Promise<LeadFirstResponseSummary> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<LeadFirstResponseSummary>(
    "/reports/leads/first-response/summary",
    params,
    signal,
  );
}

/** One scoped page of the Lead Records table. */
export function fetchLeadFirstResponseRecords(
  page: number,
  size: number,
  filters: LeadFirstResponseFilters,
  sort: SortState | undefined,
  signal?: AbortSignal,
): Promise<ListResult<LeadFirstResponseRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (sort) {
    params.set("sort", sort.key);
    params.set("direction", sort.direction);
  }
  appendFilters(params, filters);
  return apiGet<ListResult<LeadFirstResponseRow>>(
    "/reports/leads/first-response",
    params,
    signal,
  );
}

/**
 * Triggers the CSV download for the current filters. A plain anchor navigation streams the
 * attachment straight to disk (cookies ride along, so the server applies the caller's role
 * scope) — the same mechanism the Leads export uses. Never a client-side dump.
 */
export function downloadLeadFirstResponseExport(
  filters: LeadFirstResponseFilters,
): void {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  const anchor = document.createElement("a");
  anchor.href = `${env.apiBaseUrl}/reports/leads/first-response/export?${params.toString()}`;
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
