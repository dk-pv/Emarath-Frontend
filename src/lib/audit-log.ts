import { humanize, type AuditEvent } from "./audit-journey";
import { boundEnd, boundStart, rangeError } from "./date-time-range";

export const AUDIT_LOG_PATH = "/audit/log";
export const AUDIT_LOG_FILTER_OPTIONS_PATH = "/audit/log/filter-options";

/**
 * One event as the administrator's audit log returns it (AUD-02): the journey's event plus who
 * acted and what the record is called. Every sensitive value — passwords and their hashes,
 * tokens, storage paths, email addresses, search text — is hidden by the API before it gets
 * here; the screen renders what it receives and has nothing further to reveal.
 */
export type AuditLogRow = AuditEvent & {
  actorName: string | null;
  entityLabel: string | null;
};

export type AuditLogFilterOptions = {
  entityTypes: string[];
  actors: { id: string; name: string }[];
};

export type AuditLogFilters = {
  entityType: string | null;
  actorId: string | null;
  /** Calendar days in the browser's zone; the whole of each day is included. */
  from: Date | null;
  to: Date | null;
};

export const NO_AUDIT_LOG_FILTERS: AuditLogFilters = {
  entityType: null,
  actorId: null,
  from: null,
  to: null,
};

/** Why the date range can't be applied (the end before the start), or null. */
export function auditLogRangeError(filters: AuditLogFilters): string | null {
  return rangeError(
    { day: filters.from, time: null },
    { day: filters.to, time: null },
  );
}

/**
 * The query for one page. The days become the `[from, to)` ISO instants the API takes, from the
 * browser's own day edges — as every date filter here (ADR-0089) — so "To 20 Oct" includes all
 * of the 20th.
 */
export function auditLogParams(
  filters: AuditLogFilters,
  page: number,
  size: number,
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(page),
    size: String(size),
  });
  if (filters.entityType) params.set("entityType", filters.entityType);
  if (filters.actorId) params.set("actorId", filters.actorId);
  if (filters.from) params.set("from", boundStart(filters.from).toISOString());
  if (filters.to) params.set("to", boundEnd(filters.to).toISOString());
  return params;
}

export function isAuditLogFiltered(filters: AuditLogFilters): boolean {
  return Object.values(filters).some((value) => value !== null);
}

/** "TAG_ACCESS_POLICY" → "Tag Access Policy", the Journey's own wording. */
export function entityTypeLabel(type: string): string {
  return humanize(type) || "Record";
}

/** Who made a change: the person's name, or the automation that did it. */
export function auditActorLabel(row: AuditLogRow): string {
  if (row.actorType === "USER") return row.actorName ?? "Unknown user";
  return humanize(row.actorType) || "System";
}

/** The Journey's user-name lookup, built from the rows' own actor names. */
export function auditActorNames(
  rows: readonly AuditLogRow[],
): ReadonlyMap<string, string> {
  return new Map(
    rows.flatMap((row) =>
      row.actorId && row.actorName
        ? [[row.actorId, row.actorName] as const]
        : [],
    ),
  );
}
