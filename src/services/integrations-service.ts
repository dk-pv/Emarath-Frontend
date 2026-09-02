import { apiGet } from "@/lib/api-client";

/**
 * One integration as `GET /api/integrations` returns it (INT-01.1).
 *
 * `category` is a plain string, not a union: the backend stores it as free text so a new
 * provider tag never costs a migration, and the library's filter derives its options from
 * whatever the API actually returned.
 *
 * `logo` is an icon key rather than an asset path — the product ships no per-provider
 * logo art (ADR-0054 §4). `integrationIcon` in the registry resolves it.
 */
export interface Integration {
  id: string;
  key: string;
  name: string;
  description: string;
  category: string;
  logo: string;
  enabled: boolean;
  detailUrl: string | null;
  position: number;
}

/**
 * The whole integration library, already in grid order — the API sorts by `position`, so
 * the reference card sequence survives without the client re-sorting.
 *
 * Unpaginated by design: the registry is a bounded reference set the library renders as a
 * single grid, and its filter and search are client-side over that set.
 */
export function fetchIntegrations(
  signal?: AbortSignal,
): Promise<Integration[]> {
  return apiGet<Integration[]>("/integrations", undefined, signal);
}
