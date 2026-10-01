/**
 * The customer journey (ADR-0083): one lead's audit events — its own, its Logistics order's
 * and, in later phases, its Accounts records' — as `GET /audit/events?leadId=` returns them.
 *
 * Deliberately import-free, so its self-check (`audit-journey.check.ts`) compiles with plain
 * tsc. Everything here is display derivation: labels come from the event's own names or from
 * labels the app already shows, never from a meaning the event does not carry. Entity types,
 * actions and actor types are open strings on purpose — later phases add values without a
 * frontend release, so an unknown one is humanised from its own name instead of breaking.
 */

/** One event exactly as the API returns it. The JSON columns are unknown until narrowed. */
export type AuditEvent = {
  id: string;
  entityType: string;
  entityId: string;
  leadId: string | null;
  action: string;
  actorType: string;
  actorId: string | null;
  source: string;
  before: unknown;
  after: unknown;
  metadata: unknown;
  createdAt: string;
};

export const AUDIT_EVENTS_PATH = "/audit/events";

/** The API's own default; it caps a page at 200. */
export const JOURNEY_PAGE_SIZE = 50;

export function auditEventsParams(
  leadId: string,
  page: number,
  size: number,
): URLSearchParams {
  return new URLSearchParams({
    leadId,
    page: String(page),
    size: String(size),
  });
}

/**
 * The next page added to what is already shown. The API reads oldest first, so a later page
 * only ever continues the list; the id check keeps a row from showing twice if the journey
 * grew between the two reads.
 */
export function appendPage(
  shown: readonly AuditEvent[],
  next: readonly AuditEvent[],
): AuditEvent[] {
  const seen = new Set(shown.map((event) => event.id));
  return [...shown, ...next.filter((event) => !seen.has(event.id))];
}

/** Consecutive events on the same local day, in the order the API sent them. */
export function groupByDay<T extends { createdAt: string }>(
  events: readonly T[],
): { key: string; at: string; events: T[] }[] {
  const groups: { key: string; at: string; events: T[] }[] = [];
  for (const event of events) {
    const key = localDay(event.createdAt);
    const last = groups.at(-1);
    if (last?.key === key) last.events.push(event);
    else groups.push({ key, at: event.createdAt, events: [event] });
  }
  return groups;
}

function localDay(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/** A field that changed (`before` and `after`), was set (`after` only) or was removed. */
export type JourneyRow = { label: string; before?: string; after?: string };

export type JourneyEntry = {
  entity: string;
  title: string;
  /** Null when the acting user's name is not known here — the id stays in the raw record. */
  actor: string | null;
  rows: JourneyRow[];
  /** The event's metadata, minus empty values. */
  notes: { label: string; value: string }[];
};

export type JourneyLabels = {
  /** Field key → the label the app already shows for that field. */
  fields?: ReadonlyMap<string, string>;
  /** User id → display name. Best-effort: may be partial or empty. */
  users?: ReadonlyMap<string, string>;
};

const NO_LABELS: ReadonlyMap<string, string> = new Map();

/** How one event reads on the timeline. Never throws, whatever the JSON columns hold. */
export function describeAuditEvent(
  event: AuditEvent,
  labels: JourneyLabels = {},
): JourneyEntry {
  const fields = labels.fields ?? NO_LABELS;
  const users = labels.users ?? NO_LABELS;
  const label = (key: string) => fields.get(key) ?? keyText(key);
  const show = (value: unknown) => formatValue(value, users);

  const before = asRecord(event.before);
  const after = asRecord(event.after);
  const keys = [
    ...new Set([...Object.keys(before ?? {}), ...Object.keys(after ?? {})]),
  ];

  const rows = keys.flatMap((key): JourneyRow[] => {
    if (before && after) {
      return sameValue(before[key], after[key])
        ? []
        : [
            {
              label: label(key),
              before: show(before[key]),
              after: show(after[key]),
            },
          ];
    }
    // A creation records only its after-state and a deletion only its before-state: list
    // what was actually set rather than a column of dashes.
    if (after) {
      return isEmpty(after[key])
        ? []
        : [{ label: label(key), after: show(after[key]) }];
    }
    return before && !isEmpty(before[key])
      ? [{ label: label(key), before: show(before[key]) }]
      : [];
  });

  const notes = Object.entries(asRecord(event.metadata) ?? {})
    .filter(([, value]) => !isEmpty(value))
    .map(([key, value]) => ({ label: label(key), value: show(value) }));

  return {
    entity: humanize(event.entityType) || "Record",
    title: humanize(event.action) || "Change",
    actor: actorName(event, users),
    rows,
    notes,
  };
}

function actorName(
  event: AuditEvent,
  users: ReadonlyMap<string, string>,
): string | null {
  if (event.actorType === "USER") {
    return event.actorId ? (users.get(event.actorId) ?? null) : null;
  }
  // SYSTEM, INTEGRATION and any actor type a later phase adds: the event names it.
  return humanize(event.actorType) || null;
}

const ACRONYMS: ReadonlyMap<string, string> = new Map([
  ["qc", "QC"],
  ["rto", "RTO"],
  ["awb", "AWB"],
  ["id", "ID"],
  ["ids", "IDs"],
]);

/**
 * `QC_REJECTED` → "QC Rejected", `awbNumber` → "AWB Number", `PAYMENT` → "Payment". Title
 * case, as the Lead Detail labels ("Primary Phone") and the Timeline entries ("Lead Created")
 * already read, so a humanised name sits beside them without standing out.
 */
export function humanize(name: string): string {
  return name
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .split(/[\s_]+/)
    .filter(Boolean)
    .map((word) => {
      const lower = word.toLowerCase();
      return ACRONYMS.get(lower) ?? lower[0].toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** An identifier, shortened the way a commit hash is — the full value stays in the raw record. */
function shortId(value: string): string {
  return UUID.test(value) ? `${value.slice(0, 8)}…` : value;
}

function keyText(key: string): string {
  return UUID.test(key) ? shortId(key) : humanize(key);
}

function formatValue(
  value: unknown,
  users: ReadonlyMap<string, string>,
): string {
  if (isEmpty(value)) return "—";
  if (typeof value === "string") return users.get(value) ?? shortId(value);
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (Array.isArray(value)) {
    return value.map((item) => formatValue(item, users)).join(", ");
  }
  if (typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => `${keyText(key)}: ${formatValue(item, users)}`)
      .join(", ");
  }
  return String(value);
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function isEmpty(value: unknown): boolean {
  if (value === null || value === undefined || value === "") return true;
  if (Array.isArray(value)) return value.length === 0;
  const record = asRecord(value);
  return record !== null && Object.keys(record).length === 0;
}

function sameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
