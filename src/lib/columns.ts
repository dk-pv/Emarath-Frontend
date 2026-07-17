import type { ColumnPrefs, TableColumn } from "@/types";

export const NO_COLUMN_PREFS: ColumnPrefs = { order: [], hidden: [] };

/**
 * Declared columns rearranged into the user's saved order.
 *
 * Columns the saved order does not mention all share the fallback rank, so a stable sort
 * leaves them in declaration order at the end — a column added in a later release appears
 * predictably instead of reshuffling an arrangement the user chose.
 */
export function orderColumns<TRow>(
  columns: readonly TableColumn<TRow>[],
  order: readonly string[],
): TableColumn<TRow>[] {
  const rank = new Map(order.map((key, index) => [key, index]));
  const fallback = order.length;

  return [...columns].sort(
    (a, b) => (rank.get(a.key) ?? fallback) - (rank.get(b.key) ?? fallback),
  );
}

/** The columns a table actually renders: saved order, minus the ones hidden. */
export function applyColumnPrefs<TRow>(
  columns: readonly TableColumn<TRow>[],
  prefs: ColumnPrefs,
): TableColumn<TRow>[] {
  const hidden = new Set(prefs.hidden);
  return orderColumns(columns, prefs.order).filter(
    (column) => !hidden.has(column.key),
  );
}

/** Moves one key to another key's position, preserving every other key's order. */
export function moveKey(
  keys: readonly string[],
  from: string,
  to: string,
): string[] {
  const fromIndex = keys.indexOf(from);
  const toIndex = keys.indexOf(to);
  if (fromIndex === -1 || toIndex === -1 || fromIndex === toIndex) {
    return [...keys];
  }

  const next = [...keys];
  next.splice(fromIndex, 1);
  next.splice(toIndex, 0, from);
  return next;
}
