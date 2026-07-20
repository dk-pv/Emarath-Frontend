"use client";

import { useEffect, useState } from "react";

/**
 * The value, held back until it has stopped changing for `delayMs`.
 *
 * The Leads search runs server-side against 15,000+ rows, so a request per
 * keystroke is both wasteful and racy. The input stays controlled by the live
 * value (typing is never laggy); only the value that drives the fetch is
 * debounced. A trailing keystroke cancels the pending timer, so exactly one
 * request fires once the user pauses.
 */
export function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
