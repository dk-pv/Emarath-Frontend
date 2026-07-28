"use client";

import { useEffect, useState } from "react";
import type { ListQuery } from "@/types";
import { fetchGpsLocations, type GpsPinRecord } from "@/services/gps-service";

export function useGpsLocations(query: ListQuery, reloadToken: number = 0) {
  const [locations, setLocations] = useState<GpsPinRecord[] | null>(null);
  const [failedQuery, setFailedQuery] = useState<ListQuery | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchGpsLocations(query, controller.signal)
      .then((data) => {
        if (active) {
          setLocations(data);
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
  const isLoading = locations === null && !isError;

  return { locations: locations || [], isLoading, isError };
}
