"use client";

import { useEffect, useMemo, useState } from "react";
import { isAbortError } from "@/lib/api-client";
import {
  fetchDefaultLeadForm,
  type LeadForm,
} from "@/services/data-schema-service";

export type LeadFormLayout = {
  /** Whether the configured form shows this field. */
  shows: (fieldKey: string) => boolean;
  /** The section this field sits in, or null for the form's ungrouped top block. */
  sectionOf: (fieldKey: string) => string | null;
  /** The form's sections, in configured order. */
  sections: string[];
  /**
   * The given keys, filtered to what the form shows and sorted into its configured
   * order. A key the form does not mention keeps its incoming order, at the end — that
   * is a field created since the form was saved, and it renders as it did before.
   */
  orderedKeys: (keys: string[]) => string[];
  /** True once the answer is known — before that every field renders. */
  ready: boolean;
};

/** No configuration: the drawer renders exactly what it shipped with. */
const SHOW_EVERYTHING: LeadFormLayout = {
  shows: () => true,
  sectionOf: () => null,
  sections: [],
  orderedKeys: (keys) => keys,
  ready: false,
};

/**
 * The default Lead form's arrangement (Settings → Data & Schema Management → Form
 * Customization, ADR-0072 / ADR-0073), as the New/Edit Lead drawer consumes it.
 *
 * A field renders when the form shows it, in the position and section the form stores.
 * An unreachable or unconfigured settings row resolves to "show everything, unplaced", so
 * the drawer can never be left blank by a settings failure — the form it shipped with is
 * always the fallback.
 */
export function useLeadFormLayout(): LeadFormLayout {
  const [form, setForm] = useState<LeadForm | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchDefaultLeadForm(controller.signal)
      .then((result) => {
        if (!active) return;
        setForm(result && result.fields.length > 0 ? result : null);
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setForm(null);
        setReady(true);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  return useMemo(() => {
    if (!form) return { ...SHOW_EVERYTHING, ready };

    const byKey = new Map(form.fields.map((field) => [field.fieldKey, field]));
    // A key the form does not mention is a field created since it was saved: it shows,
    // exactly as it did before the form existed. Only an explicit Hidden hides a field.
    const shows = (fieldKey: string) => byKey.get(fieldKey)?.isVisible !== false;

    return {
      shows,
      sectionOf: (fieldKey) => byKey.get(fieldKey)?.sectionName ?? null,
      sections: [...form.sections]
        .sort((a, b) => a.position - b.position)
        .map((section) => section.name),
      orderedKeys: (keys) =>
        keys
          .filter(shows)
          .map((key, index) => ({
            key,
            index,
            position: byKey.get(key)?.position ?? Number.MAX_SAFE_INTEGER,
          }))
          .sort((a, b) => a.position - b.position || a.index - b.index)
          .map((entry) => entry.key),
      ready,
    };
  }, [form, ready]);
}
