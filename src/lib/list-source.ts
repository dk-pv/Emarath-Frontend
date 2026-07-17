import { matchesFilters } from "@/lib/filters";
import type {
  FilterField,
  FilterState,
  ListQuery,
  ListResult,
  SortState,
} from "@/types";

type MemorySourceOptions<TRow> = {
  rows: readonly TRow[];
  /** Definitions the conditions in a query are interpreted against. */
  fields?: readonly FilterField[];
  /** Reads a key off a row. Columns, filters and sorting all address rows by the same key. */
  getValue: (row: TRow, key: string) => string | number | null;
  /** Keys the free-text search scans. */
  searchFields?: readonly string[];
};

function sortRows<TRow>(
  rows: readonly TRow[],
  sort: SortState,
  getValue: MemorySourceOptions<TRow>["getValue"],
): TRow[] {
  const factor = sort.direction === "asc" ? 1 : -1;

  return [...rows].sort((a, b) => {
    const left = getValue(a, sort.key);
    const right = getValue(b, sort.key);
    if (typeof left === "number" && typeof right === "number") {
      return (left - right) * factor;
    }
    return String(left).localeCompare(String(right)) * factor;
  });
}

/**
 * An in-memory stand-in for a list endpoint.
 *
 * Two jobs. It backs lists whose rows genuinely are already in the browser — a dashboard
 * widget over a handful of agents has nothing to fetch. And it lets a module be built and
 * exercised against the real `ListQuery` contract before the endpoint exists, so wiring one
 * up later swaps the source and touches nothing else.
 *
 * Filtering, sorting and slicing all happen here rather than in the table, because that is
 * where the server will do them.
 */
export function createMemorySource<TRow>({
  rows,
  fields = [],
  getValue,
  searchFields = [],
}: MemorySourceOptions<TRow>) {
  return (query: ListQuery): ListResult<TRow> => {
    const state: FilterState = {
      search: query.search ?? "",
      conditions: [...(query.filters ?? [])],
    };

    const matched = rows.filter((row) =>
      matchesFilters(row, state, fields, getValue, searchFields),
    );
    const sorted = query.sort
      ? sortRows(matched, query.sort, getValue)
      : matched;
    const start = (query.page - 1) * query.size;

    return {
      rows: sorted.slice(start, start + query.size),
      total: sorted.length,
    };
  };
}
