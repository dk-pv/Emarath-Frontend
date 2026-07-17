"use client";

import { useCallback, useMemo, useState } from "react";
import type { FilterCondition, FilterField, FilterState } from "@/types";

const EMPTY: FilterState = { search: "", conditions: [] };

/** A condition with no value is a row the user has not finished filling in. */
export function isConditionActive(condition: FilterCondition): boolean {
  const { value } = condition;
  if (value === null || value === "") return false;
  if (Array.isArray(value)) return value.length > 0;
  return true;
}

/**
 * Search + multi-condition filter state for the shared panel (FND-03.2).
 *
 * Module-agnostic: it only knows the `FilterField[]` a module hands it. Matching is
 * client-side today because no backend exists; list endpoints must filter server-side
 * once they land, since Leads has to stay performant at 15,000+ records.
 */
export function useFilters(fields: readonly FilterField[]) {
  const [state, setState] = useState<FilterState>(EMPTY);

  const setSearch = useCallback(
    (search: string) => setState((s) => ({ ...s, search })),
    [],
  );

  const setCondition = useCallback(
    (key: string, value: FilterCondition["value"]) => {
      setState((s) => {
        const rest = s.conditions.filter((c) => c.key !== key);
        return { ...s, conditions: [...rest, { key, value }] };
      });
    },
    [],
  );

  const removeCondition = useCallback((key: string) => {
    setState((s) => ({
      ...s,
      conditions: s.conditions.filter((c) => c.key !== key),
    }));
  }, []);

  const clearAll = useCallback(() => setState(EMPTY), []);

  const active = useMemo(
    () => state.conditions.filter(isConditionActive),
    [state.conditions],
  );

  /** Count drives the badge on the filter control (FND-03.2 AC3); search counts as one. */
  const activeCount = active.length + (state.search.trim() ? 1 : 0);

  const valueOf = useCallback(
    (key: string) => state.conditions.find((c) => c.key === key)?.value ?? null,
    [state.conditions],
  );

  const fieldOf = useCallback(
    (key: string) => fields.find((f) => f.key === key),
    [fields],
  );

  return {
    state,
    active,
    activeCount,
    setSearch,
    setCondition,
    removeCondition,
    clearAll,
    valueOf,
    fieldOf,
  };
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

/** Client-side matcher used until list endpoints filter server-side. */
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
