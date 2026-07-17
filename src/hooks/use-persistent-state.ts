"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";

/** Same-tab writes need an explicit emitter: `storage` only fires in *other* tabs. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    // Safari private mode throws on access; the fallback is still correct.
    return null;
  }
}

/**
 * State mirrored into localStorage.
 *
 * Modelled as an external store rather than an effect that seeds state: the server
 * snapshot is always `null`, so the first client render matches the server markup and
 * the stored value is adopted on the next paint without a setState cascade.
 */
export function usePersistentState<T>(key: string, fallback: T) {
  const getSnapshot = useCallback(() => read(key), [key]);
  const getServerSnapshot = useCallback(() => null, []);

  const raw = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const value = useMemo(() => {
    if (raw === null) return fallback;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }, [raw, fallback]);

  const update = useCallback(
    (next: T | ((current: T) => T)) => {
      const resolved =
        typeof next === "function" ? (next as (c: T) => T)(value) : next;
      try {
        window.localStorage.setItem(key, JSON.stringify(resolved));
      } catch {
        // Persisting is best-effort; the UI must not break when storage is unavailable.
      }
      listeners.forEach((listener) => listener());
    },
    [key, value],
  );

  return [value, update] as const;
}
