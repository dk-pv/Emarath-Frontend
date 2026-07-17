"use client";

import { useCallback, useMemo, useState } from "react";

const NONE: ReadonlySet<string> = new Set();

/**
 * Row selection shared by every table (FND-03.1 AC3).
 *
 * Holds ids rather than rows so a selection survives the rows being refetched, and so the
 * caller decides what a selected id means (bulk update, export, delete).
 */
export function useRowSelection() {
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(NONE);

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }, []);

  /**
   * Select-all acts on the ids handed in — the rows on screen — never on rows the browser
   * has not fetched. Toggling off only clears those same ids, so a selection made on
   * another page is left alone.
   */
  const toggleAll = useCallback((ids: readonly string[]) => {
    setSelectedIds((current) => {
      const allSelected = ids.length > 0 && ids.every((id) => current.has(id));
      const next = new Set(current);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelectedIds(NONE), []);

  return useMemo(
    () => ({
      selectedIds,
      count: selectedIds.size,
      toggleRow,
      toggleAll,
      clear,
    }),
    [selectedIds, toggleRow, toggleAll, clear],
  );
}

export type RowSelection = ReturnType<typeof useRowSelection>;
