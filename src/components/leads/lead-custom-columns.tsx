import { formatDate, formatDateTime } from "@/lib/format";
import type { LeadListItem } from "@/services/leads-service";
import type { LeadCustomField } from "@/services/leads-custom-fields-service";
import type { TableColumn } from "@/types";

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
