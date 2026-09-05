import { apiGet, apiPut } from "@/lib/api-client";

/**
 * Settings → Assignment → General Settings.
 *
 * One JSON row in `app_settings`, read and written exactly as the Organization Setup and
 * Communication screens are. The small vocabularies below mirror `assignment-general.dto.ts`
 * so the offered options and the accepted values cannot drift (ADR-0069).
 */
export const LEAD_LIMIT_METHODS = [
  { value: "GLOBAL", label: "Global" },
] as const;
export type LeadLimitMethod = (typeof LEAD_LIMIT_METHODS)[number]["value"];

export const MERIDIEMS = ["AM", "PM"] as const;
export type Meridiem = (typeof MERIDIEMS)[number];

/** The re-check control is 12-hour, like the Organization shift times. */
export const RECHECK_HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
export const RECHECK_MINUTES = Array.from({ length: 60 }, (_, i) => i);

export interface AssignmentGeneralSettings {
  automaticLeadAssigning: boolean;
  carryoverLeads: boolean;
  includeFollowUpLeadsInCarryover: boolean;
  checkUserLoggedInBeforeAssigning: boolean;
  recheckHour: number | null;
  recheckMinute: number | null;
  recheckPeriod: Meridiem | null;
  leadAssignmentLimitEnabled: boolean;
  leadLimitMethod: LeadLimitMethod;
  dailyLeadLimit: number | null;
  whatsappRoundRobin: boolean;
  saveFirstIncomingMessageAsNote: boolean;
}

export function fetchAssignmentGeneral(
  signal?: AbortSignal,
): Promise<AssignmentGeneralSettings> {
  return apiGet<AssignmentGeneralSettings>(
    "/settings/assignment/general",
    undefined,
    signal,
  );
}

export function saveAssignmentGeneral(
  input: AssignmentGeneralSettings,
): Promise<AssignmentGeneralSettings> {
  return apiPut<AssignmentGeneralSettings>(
    "/settings/assignment/general",
    input,
  );
}
