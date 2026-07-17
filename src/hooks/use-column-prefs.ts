"use client";

import { useMemo } from "react";
import { usePersistentState } from "@/hooks/use-persistent-state";
import { columnPrefsKey } from "@/constants/storage";
import { NO_COLUMN_PREFS, applyColumnPrefs } from "@/lib/columns";
import type { ColumnPrefs, TableColumn } from "@/types";

/**
 * A module's column arrangement, remembered per browser (FND-03.1 AC4).
 *
 * Keyed by module rather than by table so Leads and Activities never overwrite each other.
 * Persistence is local until accounts exist; once they do this moves to the user record and
 * only the storage call underneath changes.
 */
export function useColumnPrefs<TRow>(
  moduleId: string,
  columns: readonly TableColumn<TRow>[],
) {
  const [prefs, setPrefs] = usePersistentState<ColumnPrefs>(
    columnPrefsKey(moduleId),
    NO_COLUMN_PREFS,
  );

  const visibleColumns = useMemo(
    () => applyColumnPrefs(columns, prefs),
    [columns, prefs],
  );

  return { prefs, setPrefs, visibleColumns };
}
