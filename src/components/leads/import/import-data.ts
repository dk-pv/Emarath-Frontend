import type { Step } from "@/components/ui/Stepper";
import type { ImportFieldOption } from "@/services/leads-import-service";

/** The five wizard steps, in Workpex order. */
export const IMPORT_STEPS: readonly Step[] = [
  { label: "Upload File" },
  { label: "Import Settings" },
  { label: "Map Fields" },
  { label: "Preview Data" },
  { label: "Import" },
];

/**
 * Failed/skipped rows listed on screen; the downloadable error report holds them all. A
 * 10 MB file can carry tens of thousands, which would freeze the page as table rows.
 */
export const MAX_LISTED_ERROR_ROWS = 200;

/** A mapping from each file column to a target field value, or null if unmapped. */
export type FieldMapping = Record<string, string | null>;

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The initial column→field guess: an exact match on the normalised label, against
 * the field catalog the backend serves. A file column with no matching field (e.g.
 * "Lead Name" has no field of its own) starts unmapped and is assigned by hand —
 * the exact gap the Workpex walkthrough demonstrates for Customer Name. A field is
 * given to its first matching column only — one field is fed by one column.
 */
export function autoMap(
  columns: string[],
  fields: readonly ImportFieldOption[],
): FieldMapping {
  const byNormalizedLabel = new Map(
    fields.map((field) => [normalize(field.label), field.value]),
  );
  const used = new Set<string>();
  const mapping: FieldMapping = {};
  for (const column of columns) {
    const value = byNormalizedLabel.get(normalize(column));
    mapping[column] = value && !used.has(value) ? value : null;
    if (value) used.add(value);
  }
  return mapping;
}

/** The required fields no column is mapped to yet. */
export function missingRequiredFields(
  mapping: FieldMapping,
  fields: readonly ImportFieldOption[],
): ImportFieldOption[] {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return fields.filter((field) => field.required && !mapped.has(field.value));
}
