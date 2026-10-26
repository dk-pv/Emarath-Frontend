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
