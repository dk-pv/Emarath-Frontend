import { apiGet } from "@/lib/api-client";
import type { ListQuery, ListResult } from "@/types";

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

  if (query.sort) {
    params.set("sort", query.sort.key);
    params.set("direction", query.sort.direction);
  }

  return apiGet<ListResult<LeadListItem>>("/leads", params, signal);
}
