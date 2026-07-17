"use client";

import { useMemo, useState } from "react";
import type { SortState, TableColumn } from "@/types";

type Options<TRow> = {
  rows: readonly TRow[];
  columns: readonly TableColumn<TRow>[];
  pageSize?: number;
  /** Fields searched by the free-text query. */
  searchFields: (row: TRow) => string[];
};

/**
 * Client-side search, sort and pagination.
 *
 * Deliberately client-side: no backend exists yet. List endpoints must paginate and
 * sort server-side once they land (Leads must stay performant at 15,000+ records).
 */
export function useTableControls<TRow>({
  rows,
  columns,
  pageSize = 5,
  searchFields,
}: Options<TRow>) {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortState | undefined>();
  const [page, setPage] = useState(1);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [...rows];
    return rows.filter((row) =>
      searchFields(row).some((field) => field.toLowerCase().includes(q)),
    );
  }, [rows, query, searchFields]);

  const sorted = useMemo(() => {
    if (!sort) return filtered;
    const column = columns.find((c) => c.key === sort.key);
    if (!column?.sortValue) return filtered;
    const factor = sort.direction === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const av = column.sortValue!(a);
      const bv = column.sortValue!(b);
      if (typeof av === "number" && typeof bv === "number")
        return (av - bv) * factor;
      return String(av).localeCompare(String(bv)) * factor;
    });
  }, [filtered, sort, columns]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, pageCount);
  const paged = useMemo(
    () => sorted.slice((safePage - 1) * pageSize, safePage * pageSize),
    [sorted, safePage, pageSize],
  );

  return {
    query,
    setQuery: (value: string) => {
      setQuery(value);
      setPage(1);
    },
    sort,
    setSort,
    page: safePage,
    setPage,
    pageCount,
    total: sorted.length,
    rows: paged,
  };
}
