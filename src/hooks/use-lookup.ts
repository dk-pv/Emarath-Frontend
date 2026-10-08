"use client";

import { useEffect, useState } from "react";
import { PIPELINES_CHANGED, STAGES_CHANGED } from "@/lib/catalog-events";
import {
  fetchLookup,
  type LookupOption,
  type LookupType,
} from "@/services/lookups-service";

/**
 * Loads a lookup list, shared across every field that asks for the same type.
 *
 * Lookups are small and rarely change, so the fetch is cached per type at module
 * scope: opening the drawer a second time, or ten fields reading `products`,
 * costs one request. A failed load is evicted so the next mount can retry.
 */
const cache = new Map<LookupType, Promise<LookupOption[]>>();

// A stage or pipeline edit retires the cached copy, so the next field that opens reads the
// current catalogue rather than one from before the edit.
if (typeof window !== "undefined") {
  window.addEventListener(STAGES_CHANGED, () => cache.delete("leadStatus"));
  window.addEventListener(PIPELINES_CHANGED, () => cache.delete("pipelines"));
}

function load(type: LookupType): Promise<LookupOption[]> {
  let pending = cache.get(type);
  if (!pending) {
    pending = fetchLookup(type).catch((error: unknown) => {
      cache.delete(type);
      throw error;
    });
    cache.set(type, pending);
  }
  return pending;
}

export function useLookup(type: LookupType) {
  const [loaded, setLoaded] = useState<{
    type: LookupType;
    options: LookupOption[];
  } | null>(null);
  const [failedType, setFailedType] = useState<LookupType | null>(null);

  useEffect(() => {
    let active = true;
    load(type)
      .then((result) => {
        if (active) setLoaded({ type, options: result });
      })
      .catch(() => {
        if (active) setFailedType(type);
      });
    return () => {
      active = false;
    };
  }, [type]);

  // Derived, not sequenced: loading is the absence of a result for this type, so
  // no state is set synchronously inside the effect (matches useListData).
  const isCurrent = loaded?.type === type;
  const isError = failedType === type;
  return {
    options: isCurrent ? loaded.options : [],
    isLoading: !isCurrent && !isError,
    isError,
  };
}
