import type { FilterCondition, FilterField, FilterState } from "@/types";

export const EMPTY_FILTER_STATE: FilterState = { search: "", conditions: [] };

/** A condition with no value is a row the user has not finished filling in. */
export function isConditionActive(condition: FilterCondition): boolean {
  const { value } = condition;
  if (value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/** Renders a condition's value as the text shown on its applied chip. */
export function describeCondition(
  condition: FilterCondition,
  field: FilterField | undefined,
): string {
  if (!field) return String(condition.value);
  const { value } = condition;

  if (field.type === "multi" && Array.isArray(value)) {
    const labels = value.map(
      (v) => field.options.find((o) => o.value === v)?.label ?? v,
    );
    return `${field.label}: ${labels.join(", ")}`;
  }
  if (field.type === "select" && typeof value === "string") {
    return `${field.label}: ${field.options.find((o) => o.value === value)?.label ?? value}`;
  }
  return `${field.label}: ${String(value)}`;
}

/**
 * Reference matching semantics for a `ListQuery`.
 *
 * The real filtering belongs to the server — Leads holds 15,000+ rows. This exists so a
 * mock source can behave like one, and so the eventual endpoint has a definition of what
 * each field type is supposed to mean.
 */
export function matchesFilters<TRow>(
  row: TRow,
  state: FilterState,
  fields: readonly FilterField[],
  getValue: (row: TRow, key: string) => string | number | null,
  searchFields: readonly string[],
): boolean {
  const query = state.search.trim().toLowerCase();
  if (query) {
    const hit = searchFields.some((key) =>
      String(getValue(row, key) ?? "")
        .toLowerCase()
        .includes(query),
    );
    if (!hit) return false;
  }

  return state.conditions.filter(isConditionActive).every((condition) => {
    const field = fields.find((f) => f.key === condition.key);
    if (!field) return true;
    const raw = getValue(row, condition.key);

    if (field.type === "multi" && Array.isArray(condition.value)) {
      return condition.value.includes(String(raw));
    }
    if (field.type === "number") {
      return Number(raw) >= Number(condition.value);
    }
    if (field.type === "select") {
      return String(raw) === String(condition.value);
    }
    return String(raw ?? "")
      .toLowerCase()
      .includes(String(condition.value).toLowerCase());
  });
}
