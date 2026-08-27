"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  buildConditionsPayload,
  emptyRow,
  rowsFromPayload,
  type LeadFilterRow,
} from "@/components/leads/lead-filter-config";
import {
  createSavedFilter,
  fetchSavedFilters,
  updateSavedFilter,
  type SavedFilter,
} from "@/services/saved-filters-service";

/**
 * The advanced lead filter's state — the condition-builder draft, the applied
 * `conditions` payload that drives the query, and the caller's saved presets
 * (ADR-0039/0040, ADR-0052).
 *
 * One hook for both surfaces on purpose: the Leads list and the Kanban board run the
 * identical filter, so duplicating this state is exactly how the two would drift
 * (KAN-07.1 AC5). The view keeps only the wiring to its own fetch.
 *
 * Draft vs applied is deliberate: editing rows never refetches. Only "Filter",
 * "Save & Filter" and "Update & Filter" publish a payload, so the board isn't
 * re-queried on every keystroke.
 */
export function useAdvancedFilter({
  onApplied,
}: { onApplied?: () => void } = {}) {
  const [rows, setRows] = useState<LeadFilterRow[]>(() => [emptyRow()]);
  const [appliedConditions, setAppliedConditions] = useState<
    string | undefined
  >(undefined);
  const [saved, setSaved] = useState<SavedFilter[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchSavedFilters(controller.signal)
      .then(setSaved)
      .catch((error: unknown) => {
        // Aborted on unmount; expected. Any other failure just leaves the preset row
        // empty — the condition builder itself still works.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, []);

  /** The count on the Filter trigger's badge — applied conditions, not draft rows. */
  const appliedCount = useMemo(() => {
    if (!appliedConditions) return 0;
    try {
      const parsed: unknown = JSON.parse(appliedConditions);
      return Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      return 0;
    }
  }, [appliedConditions]);

  /** The draft as a payload, or undefined when no row is complete enough to send. */
  const draftPayload = useCallback(() => buildConditionsPayload(rows), [rows]);

  const publish = useCallback(
    (payload: string | undefined) => {
      setAppliedConditions(payload);
      onApplied?.();
    },
    [onApplied],
  );

  /** "Filter" — apply the draft without touching any preset. */
  const apply = useCallback(
    () => publish(draftPayload()),
    [draftPayload, publish],
  );

  /**
   * "Clear All" — reset the draft, the applied query and the preset selection. It
   * never deletes a preset: this is a reset control, not a destructive one (ADR-0052).
   */
  const clear = useCallback(() => {
    setRows([emptyRow()]);
    setSelectedId(null);
    publish(undefined);
  }, [publish]);

  /**
   * Check a preset (or uncheck with null): its stored conditions become the draft, so
   * the user can edit before applying. Single-select — checking one unchecks the other.
   */
  const selectPreset = useCallback(
    (id: string | null) => {
      setSelectedId(id);
      const preset = id ? saved.find((f) => f.id === id) : undefined;
      setRows(preset ? rowsFromPayload(preset.conditions) : [emptyRow()]);
    },
    [saved],
  );

  /** "Save & Filter" — store the draft as a new preset, select it, and apply it. */
  const savePreset = useCallback(
    async (name: string) => {
      const payload = draftPayload();
      const created = await createSavedFilter(name, payload ?? "[]");
      setSaved((current) => [...current, created]);
      setSelectedId(created.id);
      publish(payload);
      return created;
    },
    [draftPayload, publish],
  );

  /** "Update & Filter" — overwrite the checked preset's conditions, keeping its name. */
  const updatePreset = useCallback(async () => {
    if (!selectedId) return null;
    const payload = draftPayload();
    const updated = await updateSavedFilter(selectedId, {
      conditions: payload ?? "[]",
    });
    setSaved((current) =>
      current.map((f) => (f.id === updated.id ? updated : f)),
    );
    publish(payload);
    return updated;
  }, [draftPayload, publish, selectedId]);

  return {
    rows,
    setRows,
    appliedConditions,
    appliedCount,
    saved,
    selectedId,
    apply,
    clear,
    selectPreset,
    savePreset,
    updatePreset,
  };
}

export type AdvancedFilterState = ReturnType<typeof useAdvancedFilter>;
