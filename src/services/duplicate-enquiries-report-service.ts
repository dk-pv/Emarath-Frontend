import { apiGet } from "@/lib/api-client";
import type { ListResult } from "@/types";

/** The thresholds the cards count against; mirrors `DUPLICATE_THRESHOLDS`. */
export const DUPLICATE_THRESHOLDS = [1, 2, 3, 4, 5] as const;

/** The five threshold cards, mirroring `DuplicateEnquiriesKpis`. */
export interface DuplicateEnquiriesKpis {
  /** Keyed by threshold — `{ "1": 12, "2": 4, … }`. */
  leadsWithAtLeast: Record<string, number>;
}

export interface DuplicateEnquiriesAgentRef {
  id: string;
  name: string;
}

/** One duplicate group, mirroring `DuplicateEnquiryRow`. */
export interface DuplicateEnquiryRow {
  id: string;
  name: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  primaryEmail: string | null;
  secondaryEmail: string | null;
  duplicateCount: number;
  latestEnquiryAt: string;
  assignedTo: DuplicateEnquiriesAgentRef[];
  sources: string[];
}

export interface DuplicateEnquiriesFilters {
  from?: string;
  to?: string;
  agent?: string[];
  source?: string[];
}

function appendFilters(
  params: URLSearchParams,
  filters: DuplicateEnquiriesFilters,
): void {
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  for (const agent of filters.agent ?? []) params.append("agent", agent);
  for (const source of filters.source ?? []) params.append("source", source);
}

/** One page of duplicate groups. */
export function fetchDuplicateEnquiries(
  page: number,
  size: number,
  filters: DuplicateEnquiriesFilters,
  signal?: AbortSignal,
): Promise<ListResult<DuplicateEnquiryRow>> {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  appendFilters(params, filters);
  return apiGet<ListResult<DuplicateEnquiryRow>>(
    "/reports/leads/duplicate-enquiries",
    params,
    signal,
  );
}

/** The five threshold cards, over the same groups the table lists. */
export function fetchDuplicateEnquiriesSummary(
  filters: DuplicateEnquiriesFilters,
  signal?: AbortSignal,
): Promise<{ kpis: DuplicateEnquiriesKpis }> {
  const params = new URLSearchParams();
  appendFilters(params, filters);
  return apiGet<{ kpis: DuplicateEnquiriesKpis }>(
    "/reports/leads/duplicate-enquiries/summary",
    params,
    signal,
  );
}
