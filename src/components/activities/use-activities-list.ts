"use client";

import { useCallback, useEffect, useState } from "react";
import {
  fetchActivities,
  type ActivitiesQuery,
  type ActivityBucketCounts,
  type ActivityListItem,
} from "@/services/activities-service";

type Loaded = {
  query: ActivitiesQuery;
  rows: readonly ActivityListItem[];
  total: number;
  counts: ActivityBucketCounts;
};

/**
 * Fetches a page of the Activities worklist and tracks its lifecycle.
 *
 * A purpose-built sibling of `useListData`: that hook is hard-typed to the Leads
 * `ListQuery`/`{ rows, total }` shape and cannot carry the bucket, the tz day
 * boundaries, or the per-bucket `counts` this endpoint returns. The correctness
 * rules are copied from it: results are tagged with the query they answer and
 * only count as current when that tag is the query in hand (so a slow earlier
 * page can't repaint a newer one — `query` is a stable ref from the caller's
 * useMemo), and no state is set synchronously inside the effect. Counts are
 * returned last-known even mid-load, since they are the same totals for every
 * bucket and never depend on the page.
 */
export function useActivitiesList(query: ActivitiesQuery) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failedQuery, setFailedQuery] = useState<ActivitiesQuery | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchActivities(query, controller.signal)
      .then((result) => {
        if (active) {
          setLoaded({
            query,
            rows: result.rows,
            total: result.total,
            counts: result.counts,
          });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        // A superseded request aborts; that is expected, not a failure.
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailedQuery(query);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [query, reloadToken]);

  const isCurrent = loaded?.query === query;
  const isError = failedQuery === query;
  const isLoading = !isCurrent && !isError;

  const refetch = useCallback(() => {
    setFailedQuery(null);
    setReloadToken((token) => token + 1);
  }, []);

  return {
    rows: isCurrent ? loaded.rows : ([] as readonly ActivityListItem[]),
    total: isCurrent ? loaded.total : 0,
    // Last-known counts stay on the tabs through a page or bucket change.
    counts: loaded ? loaded.counts : null,
    isLoading,
    isError,
    refetch,
  };
}
