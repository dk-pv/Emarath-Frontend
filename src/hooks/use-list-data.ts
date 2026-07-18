"use client";

import { useCallback, useEffect, useState } from "react";
import type { ListQuery, ListResult } from "@/types";

/**
 * A source of pages. Accepts an optional signal so an HTTP source can be
 * cancelled; an in-memory source ignores it. This is the seam that lets the
 * shared table run against either.
 */
export type ListDataSource<T> = (
  query: ListQuery,
  signal?: AbortSignal,
) => Promise<ListResult<T>> | ListResult<T>;

type Loaded<T> = { query: ListQuery; rows: readonly T[]; total: number };

/**
 * Fetches a page for `query` and tracks its lifecycle (FND list plumbing reused
 * by every module; here it drives the Leads list).
 *
 * Correctness rests on two things:
 *
 * - Staleness is decided by identity, not by arrival order. Each result is
 *   tagged with the query it answers, and only counts as current when that tag
 *   is the query in hand — so a slow response for page 1 landing after page 2
 *   cannot repaint page 2's rows. `query` is a stable reference from
 *   `useListQuery` until something actually changes, which makes the comparison
 *   exact.
 * - No state is set synchronously inside the effect. Every setState runs after
 *   an await or in an event handler, which keeps the loading signal derived
 *   rather than sequenced and avoids the render cascade the lint rule guards.
 */
export function useListData<T>(source: ListDataSource<T>, query: ListQuery) {
  const [loaded, setLoaded] = useState<Loaded<T> | null>(null);
  const [failedQuery, setFailedQuery] = useState<ListQuery | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    Promise.resolve(source(query, controller.signal))
      .then((result) => {
        if (active) {
          setLoaded({ query, rows: result.rows, total: result.total });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        // A superseded request aborts; that is expected, not a failure.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailedQuery(query);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [source, query, reloadToken]);

  const isCurrent = loaded?.query === query;
  const isError = failedQuery === query;
  const isLoading = !isCurrent && !isError;

  const refetch = useCallback(() => {
    setFailedQuery(null);
    setReloadToken((token) => token + 1);
  }, []);

  return {
    rows: isCurrent ? loaded.rows : ([] as readonly T[]),
    total: isCurrent ? loaded.total : 0,
    isLoading,
    isError,
    refetch,
  };
}
