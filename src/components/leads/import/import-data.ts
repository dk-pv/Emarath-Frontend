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

/** A mapping from each file column to a target field value, or null if unmapped. */
export type FieldMapping = Record<string, string | null>;

const normalize = (value: string) =>
  value.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * The initial column→field guess: an exact match on the normalised label, against
 * the field catalog the backend serves. A file column with no matching field (e.g.
 * "Lead Name" has no field of its own) starts unmapped and is assigned by hand —
 * the exact gap the Workpex walkthrough demonstrates for Customer Name.
 */
export function autoMap(
  columns: string[],
  fields: readonly ImportFieldOption[],
): FieldMapping {
  const byNormalizedLabel = new Map(
    fields.map((field) => [normalize(field.label), field.value]),
  );
  const mapping: FieldMapping = {};
  for (const column of columns) {
    mapping[column] = byNormalizedLabel.get(normalize(column)) ?? null;
  }
  return mapping;
}

/** Every required field is mapped by at least one column. */
export function requiredFieldsMapped(
  mapping: FieldMapping,
  fields: readonly ImportFieldOption[],
): boolean {
  const mapped = new Set(Object.values(mapping).filter(Boolean));
  return fields
    .filter((field) => field.required)
    .every((field) => mapped.has(field.value));
}
