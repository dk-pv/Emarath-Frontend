import { apiGet, apiPut } from "@/lib/api-client";

/**
 * Settings → Sales & CRM Configuration → Duplicate Settings.
 *
 * Stored as one JSON row in `app_settings`, exactly as General Settings is. The screen
 * configures what happens *after* a duplicate is found; the matching fields themselves
 * (primary phone, secondary phone, email) are fixed and not configurable (ADR-0064).
 */

export const DUPLICATE_MODES = ["WARN_ALLOW_SAVE", "BLOCK_HARD_STOP"] as const;
export type DuplicateMode = (typeof DUPLICATE_MODES)[number];

/** One recorded configuration change — what the Activity Log lists. */
export interface DuplicateSettingsLogEntry {
  at: string;
  byName: string | null;
  changes: string[];
}

export interface DuplicateSettings {
  mode: DuplicateMode;
  allowDuplicateSearch: boolean;
  displayAssigneeInfo: boolean;
  checkArchivedLeads: boolean;
  /** Newest first; written by the server, never by this client. */
  log: DuplicateSettingsLogEntry[];
}

/** What the form submits — the log is not writable. */
export type UpdateDuplicateSettingsInput = Omit<DuplicateSettings, "log">;

export function fetchDuplicateSettings(
  signal?: AbortSignal,
): Promise<DuplicateSettings> {
  return apiGet<DuplicateSettings>(
    "/settings/sales-crm/duplicate",
    undefined,
    signal,
  );
}

export function saveDuplicateSettings(
  input: UpdateDuplicateSettingsInput,
): Promise<DuplicateSettings> {
  return apiPut<DuplicateSettings>("/settings/sales-crm/duplicate", input);
}
