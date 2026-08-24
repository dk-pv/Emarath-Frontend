import type { LeadListItem } from "@/services/leads-service";
import type { LeadCustomField } from "@/services/leads-custom-fields-service";
import type { TableColumn } from "@/types";

/** Workpex date display, e.g. "16-07-2026" — matches the standard date columns. */
function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  return `${dd}-${mm}-${date.getFullYear()}`;
}

/** Workpex date-time display, e.g. "16-07-2026, 11:39 AM" — matches Created Date. */
function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const time = date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `${dd}-${mm}-${date.getFullYear()}, ${time}`;
}

/** A custom column's cell: the lead's value formatted by type; blank shows the same
 * muted em dash the standard columns use, so an empty cell never reads as a gap. */
function renderValue(field: LeadCustomField, raw: string | undefined) {
  if (!raw) return <span className="text-ink-subtle">—</span>;
  switch (field.type) {
    case "DATE":
      return formatDate(raw);
    case "DATETIME":
      return formatDateTime(raw);
    default:
      return raw; // TEXT / TEXTBOX / NUMBER — shown as entered
  }
}

/**
 * Turns fetched custom-field definitions into Leads table columns (LEAD-05.1). The
 * column key is the field's stable "cf_<slug>" key, so a custom column flows through
 * the same Manage Columns / per-user layout path as a standard one; the cell reads
 * `row.customFields[key]`. Not header-sortable — like the standard Leads columns,
 * sorting stays a toolbar concern (custom-field sort is a later, separate task).
 */
export function buildCustomColumns(
  fields: readonly LeadCustomField[],
): TableColumn<LeadListItem>[] {
  return fields.map((field) => ({
    key: field.key,
    header: field.name,
    align: field.type === "NUMBER" ? ("right" as const) : undefined,
    render: (row: LeadListItem) =>
      renderValue(field, row.customFields[field.key]),
  }));
}
