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
  | "CHECK_IN"
  | "CHECK_OUT"
  | "LOCATION_CHECK_IN"
  | "AUTOMATIC_TRACKING"
  | "FOLLOW_UP_COMPLETION";

export type GpsPinRecord = {
  id: string;
  type: GpsPinType;
  lat: number;
  lng: number;
  timestamp: string; // ISO String from API
  agentId: string;
  agentName: string;
};

/**
 * The "Filter by Event" options, from the Workpex filter popover. `All` is the absence
 * of a filter and is expressed as `null`, not a member — the same convention the
 * Documents type filter uses. Follow-up Completion is included because it is a real pin
 * type the legend already names; leaving it out would make one marker class unfilterable.
 */
export const GPS_EVENT_FILTERS: { value: GpsPinType; label: string }[] = [
  { value: "CHECK_IN", label: "Check-in" },
  { value: "CHECK_OUT", label: "Check-out" },
  { value: "LOCATION_CHECK_IN", label: "Location Check-in" },
  { value: "AUTOMATIC_TRACKING", label: "Automatic Tracking" },
  { value: "FOLLOW_UP_COMPLETION", label: "Follow-up Completion" },
];

const EVENT_LABEL = new Map(GPS_EVENT_FILTERS.map((o) => [o.value, o.label]));

/** The Status label a record shows in the list, legend and export. */
export function gpsEventLabel(type: GpsPinType): string {
  return EVENT_LABEL.get(type) ?? type;
}

/**
 * The one place GPS records are narrowed for display (GPS-06.1 AC2).
 *
 * The server already scoped the fetch by role, period and Team Member; this applies the
 * two dimensions that exist only in the browser — the event type and the free-text search
 * — and returns the single array the KPIs' record views, the map markers, the table rows
 * and the export all read. Keeping it here, rather than inside the map and the table
 * separately, is what makes those four provably agree: there is one filtered set, not
 * three implementations of one.
 */
export function filterGpsRecords(
  records: GpsPinRecord[],
  options: { event?: GpsPinType | null; search?: string },
): GpsPinRecord[] {
  const term = options.search?.trim().toLowerCase() ?? "";
  const event = options.event ?? null;
  if (!event && !term) return records;

  return records.filter((record) => {
    if (event && record.type !== event) return false;
    if (!term) return true;
    // Searches the fields the row actually shows. Address and Notes carry no data
    // yet (the schema has no column for either), so they cannot be matched on.
    return (
      record.agentName.toLowerCase().includes(term) ||
      gpsEventLabel(record.type).toLowerCase().includes(term)
    );
  });
}

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
  return apiGet<GpsSummaryRecord>("/gps/summary", queryToSearch(query), signal);
}

export function fetchGpsLocations(
  query: ListQuery,
  signal?: AbortSignal,
): Promise<GpsPinRecord[]> {
  return apiGet<GpsPinRecord[]>("/gps/locations", queryToSearch(query), signal);
}
