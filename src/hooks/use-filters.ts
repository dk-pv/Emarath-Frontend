"use client";

import { useCallback, useMemo, useState } from "react";
import { EMPTY_FILTER_STATE, isConditionActive } from "@/lib/filters";
import type { FilterCondition, FilterField, FilterState } from "@/types";

/**
 * Search + multi-condition filter state for the shared panel (FND-03.2).
 *
 * Module-agnostic: it only knows the `FilterField[]` a module hands it. It produces the
 * state; `useListQuery` folds that into the query a list endpoint is driven by.
 */
export function useFilters(fields: readonly FilterField[]) {
  const [state, setState] = useState<FilterState>(EMPTY_FILTER_STATE);

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

  const clearAll = useCallback(() => setState(EMPTY_FILTER_STATE), []);

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
