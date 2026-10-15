import { apiGet, apiPut } from "@/lib/api-client";

/**
 * Settings → Sales & CRM Configuration → Duplicate Settings.
 *
 * Stored as one JSON row in `app_settings`, exactly as General Settings is. The matching
 * fields (primary phone, secondary phone, email) are fixed and not configurable (ADR-0064).
 *
 * There is no handling mode any more: a duplicate is always saved as its own lead and linked to
 * the lead it duplicates (ADR-0092). The "Block, hard stop" option is gone, so no setting here can
 * make a lead be refused.
 */

/** One recorded configuration change — what the Activity Log lists. */
export interface DuplicateSettingsLogEntry {
  at: string;
  byName: string | null;
  changes: string[];
}

export interface DuplicateSettings {
  allowDuplicateSearch: boolean;
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
