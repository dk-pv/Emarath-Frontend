import { apiGet } from "@/lib/api-client";

/** One dropdown option (ADR-0005). `value` is what a lead stores; `label` is shown. */
export interface LookupOption {
  value: string;
  label: string;
}

/**
 * The config/DB-backed lookup lists the New Lead form reads. `tags` is served from
 * the database; the rest are config-backed today. Countries and states are a
 * static frontend dataset, so they are deliberately not fetched here.
 */
export type LookupType =
  | "leadStatus"
  | "pipelines"
  | "languages"
  | "sources"
  | "callStatus"
  | "attemptCounts"
  | "categories"
  | "paymentMethods"
  | "complaintReasons"
  | "products"
  | "tags";

export function fetchLookup(
  type: LookupType,
  signal?: AbortSignal,
): Promise<LookupOption[]> {
  return apiGet<LookupOption[]>(`/lookups/${type}`, undefined, signal);
}

export function fetchAssignableAgents(
  signal?: AbortSignal,
): Promise<{ id: string; name: string }[]> {
  return apiGet<{ id: string; name: string }[]>(
    "/leads/assignable-agents",
    undefined,
    signal,
  );
}
