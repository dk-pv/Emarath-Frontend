"use client";

import { useCallback, useMemo, useState } from "react";
import { isConditionActive } from "@/lib/filters";
import { DEFAULT_PAGE_SIZE } from "@/constants/table";
import type { FilterState, ListQuery, SortState } from "@/types";

type Options = {
  size?: number;
  /** Search and conditions from `useFilters`, folded into the query the server receives. */
  filters?: FilterState;
};

/**
 * Owns the paging and sorting a list endpoint is driven by (FND-03.1 AC1/AC2).
 *
 * The browser never holds the whole result set, so every one of these knobs has to travel
 * to the server. Sorting and sizing send the user back to page 1: page 4 of a 4-page result
 * is off the end once the page size grows, and a re-sorted page 4 shows unrelated rows.
 */
export function useListQuery({ size: initialSize, filters }: Options = {}) {
  const [page, setPage] = useState(1);
  const [size, setSizeState] = useState(initialSize ?? DEFAULT_PAGE_SIZE);
  const [sort, setSortState] = useState<SortState | undefined>();

  const resetPage = useCallback(() => setPage(1), []);

  const setSort = useCallback((next: SortState) => {
    setSortState(next);
    setPage(1);
  }, []);

  const setSize = useCallback((next: number) => {
    setSizeState(next);
    setPage(1);
  }, []);

  const query: ListQuery = useMemo(
    () => ({
      page,
      size,
      sort,
      search: filters?.search.trim() || undefined,
      filters: filters?.conditions.filter(isConditionActive),
    }),
    [page, size, sort, filters],
  );

  return { query, page, size, sort, setPage, setSize, setSort, resetPage };
}
