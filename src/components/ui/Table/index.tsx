"use client";

import {
  IconChevronDown,
  IconChevronUp,
  IconSelector,
} from "@tabler/icons-react";
import { Checkbox } from "@/components/ui/Checkbox";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import type { SortDirection, SortState, TableColumn } from "@/types";

/** Row selection wiring (FND-03.1 AC3). Supply it to grow a leading checkbox column. */
export type TableSelection<TRow> = {
  selectedIds: ReadonlySet<string>;
  onToggleRow: (id: string) => void;
  /** Receives the ids of every row currently rendered — never rows still on the server. */
  onToggleAll: (ids: string[]) => void;
  /** Accessible name for a row's checkbox. Falls back to the row id. */
  rowLabel?: (row: TRow) => string;
  /** Accessible name for the header checkbox. */
  allLabel?: string;
};

type TableProps<TRow> = {
  columns: readonly TableColumn<TRow>[];
  /** One page of rows. A `ListResult` hands its page straight in. */
  rows: readonly TRow[];
  getRowId: (row: TRow) => string;
  sort?: SortState;
  onSortChange?: (sort: SortState) => void;
  selection?: TableSelection<TRow>;
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

/** `w-px` collapses the checkbox column to its content — the data columns take the slack. */
const SELECT_CELL_CLASS = "w-px px-4 py-3";

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
  selection,
  isLoading,
  emptyState,
  errorState,
}: TableProps<TRow>) {
  const pageIds = rows.map(getRowId);
  const selectedOnPage = selection
    ? pageIds.filter((id) => selection.selectedIds.has(id)).length
    : 0;
  const allOnPageSelected =
    pageIds.length > 0 && selectedOnPage === pageIds.length;

  /** The header spans the columns plus the checkbox, so message rows must too. */
  const columnCount = columns.length + (selection ? 1 : 0);

  let body: React.ReactNode;

  if (errorState) {
    body = <MessageRow columnCount={columnCount}>{errorState}</MessageRow>;
  } else if (isLoading) {
    body = Array.from({ length: SKELETON_ROW_COUNT }, (_, index) => (
      <tr key={index} className="border-b border-hairline last:border-b-0">
        {selection && (
          <td className={SELECT_CELL_CLASS}>
            <Skeleton className="size-5" />
          </td>
        )}
        {columns.map((column) => (
          <td key={column.key} className={cn(CELL_CLASS, column.className)}>
            <Skeleton className="h-4 w-full" />
          </td>
        ))}
      </tr>
    ));
  } else if (rows.length === 0) {
    body = emptyState ? (
      <MessageRow columnCount={columnCount}>{emptyState}</MessageRow>
    ) : null;
  } else {
    body = rows.map((row) => {
      const id = getRowId(row);

      return (
        <tr
          key={id}
          // `group` lets a sticky column's own background follow the row hover
          // (via group-hover on that column's className); harmless otherwise.
          className="group border-b border-hairline transition-colors duration-(--duration-shell) ease-shell last:border-b-0 hover:bg-canvas"
        >
          {selection && (
            <td className={SELECT_CELL_CLASS}>
              <Checkbox
                checked={selection.selectedIds.has(id)}
                onChange={() => selection.onToggleRow(id)}
                aria-label={selection.rowLabel?.(row) ?? `Select ${id}`}
              />
            </td>
          )}
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
      );
    });
  }

  return (
    <table className="w-full border-collapse text-sm text-ink">
      <thead>
        <tr className="border-b border-hairline">
          {selection && (
            <th scope="col" className={SELECT_CELL_CLASS}>
              <Checkbox
                checked={allOnPageSelected}
                indeterminate={selectedOnPage > 0 && !allOnPageSelected}
                disabled={pageIds.length === 0}
                onChange={() => selection.onToggleAll(pageIds)}
                aria-label={
                  selection.allLabel ?? "Select all rows on this page"
                }
              />
            </th>
          )}

          {columns.map((column) => {
            const align = column.align ?? "left";
            const active = sort?.key === column.key;

            return (
              <th
                key={column.key}
                scope="col"
                aria-sort={ariaSortFor(column, sort)}
                className={cn(
                  // Title case, not uppercase: Workpex shows the column names as
                  // configured (e.g. "Customer Name"), never transformed.
                  "px-4 py-3 text-xs font-medium whitespace-nowrap text-ink-muted",
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
