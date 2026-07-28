"use client";

import { useEffect, useState } from "react";
import type { ListQuery } from "@/types";
import { fetchGpsSummary, type GpsSummaryRecord } from "@/services/gps-service";

export function useGpsSummary(query: ListQuery, reloadToken: number = 0) {
  const [summary, setSummary] = useState<GpsSummaryRecord | null>(null);
  const [failedQuery, setFailedQuery] = useState<ListQuery | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchGpsSummary(query, controller.signal)
      .then((data) => {
        if (active) {
          setSummary(data);
          setFailedQuery(null);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailedQuery(query);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [query, reloadToken]);

  const isError = failedQuery === query;
  const isLoading = summary === null && !isError;

  return { summary, isLoading, isError };
}
