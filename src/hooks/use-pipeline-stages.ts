"use client";

import { useEffect, useState } from "react";
import { PIPELINES_CHANGED, STAGES_CHANGED } from "@/lib/catalog-events";
import { fetchStages, type Stage } from "@/services/stages-service";

/**
 * One pipeline's stages, shared by every control that asks for the same pipeline: a page of
 * lead rows costs one request per pipeline on it, not one per row. Cached at module scope
 * like `useLookup`; a failed load is evicted so the next mount retries, and a stage or
 * pipeline edit retires the cache and refetches for every mounted reader.
 */
const cache = new Map<string, Promise<Stage[]>>();

function load(pipeline: string): Promise<Stage[]> {
  let pending = cache.get(pipeline);
  if (!pending) {
    pending = fetchStages(pipeline).catch((error: unknown) => {
      cache.delete(pipeline);
      throw error;
    });
    cache.set(pipeline, pending);
  }
  return pending;
}

/** The pipeline's stages in order, or null until they have loaded (or if they can't). */
export function usePipelineStages(pipeline: string): Stage[] | null {
  const [loaded, setLoaded] = useState<{
    pipeline: string;
    stages: Stage[];
  } | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    const changed = () => {
      cache.clear();
      setNonce((value) => value + 1);
    };
    window.addEventListener(STAGES_CHANGED, changed);
    window.addEventListener(PIPELINES_CHANGED, changed);
    return () => {
      window.removeEventListener(STAGES_CHANGED, changed);
      window.removeEventListener(PIPELINES_CHANGED, changed);
    };
  }, []);

  useEffect(() => {
    let active = true;
    load(pipeline)
      .then((stages) => {
        if (active) setLoaded({ pipeline, stages });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pipeline, nonce]);

  return loaded?.pipeline === pipeline ? loaded.stages : null;
}
