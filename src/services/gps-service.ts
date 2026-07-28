import { apiGet } from "@/lib/api-client";
import type { ListQuery } from "@/types";

export type GpsSummaryRecord = {
  totalCheckIns: number;
  totalCheckOuts: number;
  locationCheckIns: number;
  automaticTracking: number;
  followUpCompletions: number;
};

export type GpsPinType =
  | 'CHECK_IN'
  | 'CHECK_OUT'
  | 'LOCATION_CHECK_IN'
  | 'AUTOMATIC_TRACKING'
  | 'FOLLOW_UP_COMPLETION';

export type GpsPinRecord = {
  id: string;
  type: GpsPinType;
  lat: number;
  lng: number;
  timestamp: string; // ISO String from API
  agentId: string;
  agentName: string;
};

function queryToSearch(query: ListQuery): URLSearchParams {
  const search = new URLSearchParams();
  for (const { key, value } of query.filters ?? []) {
    if (value === null || value === "") continue;
    search.set(key, String(value));
  }
  return search;
}

export function fetchGpsSummary(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<GpsSummaryRecord> {
  return apiGet<GpsSummaryRecord>(
    "/gps/summary",
    queryToSearch(query),
    signal,
  );
}

export function fetchGpsLocations(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<GpsPinRecord[]> {
  return apiGet<GpsPinRecord[]>(
    "/gps/locations",
    queryToSearch(query),
    signal,
  );
}
