"use client";

import { useEffect, useState } from "react";
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
