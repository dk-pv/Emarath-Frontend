"use client";

import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { SortDirection, SortState, TableColumn } from "@/types";

type TableProps<TRow> = {
  columns: TableColumn<TRow>[];
  rows: TRow[];
  getRowId: (row: TRow) => string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  isLoading?: boolean;
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
};

type Align = NonNullable<TableColumn<unknown>["align"]>;

const CELL_ALIGN: Record<Align, string> = {
  left: "text-left",
  right: "text-right",
  center: "text-center",
};

const HEADER_ALIGN: Record<Align, string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
};

/** Cells never wrap, so the table grows past a narrow ResponsiveTableContainer and scrolls. */
const CELL_CLASS = "px-4 py-3 whitespace-nowrap";

const SKELETON_ROW_COUNT = 5;

function ariaSortFor<TRow>(
  column: TableColumn<TRow>,
  sort: SortState | undefined,
): "ascending" | "descending" | "none" | undefined {
  if (!column.sortable) return undefined;
  if (sort?.key !== column.key) return "none";
  return sort.direction === "asc" ? "ascending" : "descending";
}

function nextSortFor<TRow>(
  column: TableColumn<TRow>,
  sort: SortState | undefined,
): SortState {
  const active = sort?.key === column.key;
  return {
    key: column.key,
    direction: active && sort?.direction === "asc" ? "desc" : "asc",
  };
}

function SortGlyph({ direction }: { direction?: SortDirection }) {
  if (direction === "asc") {
    return <IconChevronUp size={14} stroke={2} className="shrink-0 text-ink" />;
  }
  if (direction === "desc") {
    return (
      <IconChevronDown size={14} stroke={2} className="shrink-0 text-ink" />
    );
  }
  return (
    <IconSelector size={14} stroke={2} className="shrink-0 text-ink-subtle" />
  );
}

function MessageRow({
  columnCount,
  children,
}: {
  columnCount: number;
  children: React.ReactNode;
}) {
  return (
    <tr>
      <td colSpan={columnCount} className="px-4 py-10">
        {children}
      </td>
    </tr>
  );
}

export function Table<TRow>({
  columns,
  rows,
  getRowId,
  sort,
  onSortChange,
  isLoading,
  emptyState,
  errorState,
}: TableProps<TRow>) {
  let body: React.ReactNode;

  if (errorState) {
    body = <MessageRow columnCount={columns.length}>{errorState}</MessageRow>;
  } else if (isLoading) {
    body = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
      <tr key={index} className="border-b border-hairline last:border-b-0">
        {columns.map((column) => (
          <td key={column.key} className={cn(CELL_CLASS, column.className)}>
            <Skeleton className="h-4 w-full" />
          </td>
        ))}
      </tr>
    ));
  } else if (rows.length === 0) {
    body = emptyState ? (
      <MessageRow columnCount={columns.length}>{emptyState}</MessageRow>
    ) : null;
  } else {
    body = rows.map((row) => (
      <tr
        key={getRowId(row)}
        className="border-b border-hairline transition-colors duration-(--duration-shell) ease-shell last:border-b-0 hover:bg-canvas"
      >
        {columns.map((column) => (
          <td
            key={column.key}
            className={cn(
              CELL_CLASS,
              CELL_ALIGN[column.align ?? "left"],
              column.className,
            )}
          >
            {column.render(row)}
          </td>
        ))}
      </tr>
    ));
  }

  return (
    <table className="w-full border-collapse text-sm text-ink">
      <thead>
        <tr className="border-b border-hairline">
          {columns.map((column) => {
            const align = column.align ?? "left";
            const active = sort?.key === column.key;

            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSortFor(column, sort)}
                className={cn(
                  "px-4 py-3 text-xs font-medium tracking-wide whitespace-nowrap text-ink-muted uppercase",
                  CELL_ALIGN[align],
                  column.className,
                )}
              >
                {column.sortable ? (
                  <button
                    type="button"
                    onClick={() => onSortChange?.(nextSortFor(column, sort))}
                    className={cn(
                      "focus-ring-inset flex w-full items-center gap-1 rounded-control transition-colors duration-(--duration-shell) ease-shell hover:text-ink",
                      HEADER_ALIGN[align],
                      active && "text-ink",
                    )}
                  >
                    <span>{column.header}</span>
                    <SortGlyph
                      direction={active ? sort?.direction : undefined}
                    />
                  </button>
                ) : (
                  column.header
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>{body}</tbody>
    </table>
  );
}
