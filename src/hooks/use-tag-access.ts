"use client";

import { useEffect, useMemo, useState } from "react";
import { TAGS_CHANGED } from "@/lib/catalog-events";
import {
  fetchMyTagAccess,
  type MyTagAccess,
} from "@/services/tag-access-service";

/**
 * What the signed-in user may do with tags (Tag Permissions, ADR-0091): the tags they may
 * select, and whether they may create one.
 *
 * Not cached across mounts, unlike `useLookup`: this is the Admin's configuration for one
 * person, so a picker that opens after the Admin saved a change must see it. A tag created
 * or a permission saved in this session fires `TAGS_CHANGED`, which every mounted reader
 * answers by asking again.
 *
 * While the answer is loading, or if it cannot be read, nothing is selectable and nothing
 * can be created — the safe direction. The server enforces the rule either way.
 */
export function useTagAccess() {
  const [reload, setReload] = useState(0);
  const [result, setResult] = useState<{
    token: number;
    access: MyTagAccess | null;
  } | null>(null);

  useEffect(() => {
    const onChanged = () => setReload((token) => token + 1);
    window.addEventListener(TAGS_CHANGED, onChanged);
    return () => window.removeEventListener(TAGS_CHANGED, onChanged);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    fetchMyTagAccess(controller.signal)
      .then((access) => setResult({ token: reload, access }))
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setResult({ token: reload, access: null });
      });
    return () => controller.abort();
  }, [reload]);

  // The first answer is the only one that counts as "loading": a refetch keeps showing the
  // previous list until the new one arrives, so a picker never flashes empty mid-session.
  const access = result?.access ?? null;
  return useMemo(
    () => ({
      tags: access?.tags ?? [],
      canCreate: access?.canCreate ?? false,
      restricted: access?.restricted ?? false,
      isLoading: result === null,
      isError: result !== null && result.access === null,
    }),
    [access, result],
  );
}
