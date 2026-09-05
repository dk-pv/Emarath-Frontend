import { apiGet, apiPatch, apiPut } from "@/lib/api-client";

/**
 * Settings → Call Tracking.
 *
 * Two JSON rows in `app_settings`, read and written exactly as the other settings screens
 * are. The vocabularies mirror `call-tracking.dto.ts` so the offered options and the
 * accepted values cannot drift (ADR-0070).
 */

/**
 * The reference shows the product's own name selected in both Call Type fields and never
 * shows either dropdown open, so this is the only option evidence exists for.
 */
export const CALL_TYPE_OPTIONS = [
  { value: "EMARATH", label: "Emarath" },
] as const;
export type CallType = (typeof CALL_TYPE_OPTIONS)[number]["value"];

/** Both captured, in the reference's own order. */
export const CALL_PROVIDER_MODE_OPTIONS = [
  { value: "TOTAL_CALLS", label: "Total Calls" },
  { value: "UNIQUE_CALLS", label: "Unique Calls" },
] as const;
export type CallProviderMode =
  (typeof CALL_PROVIDER_MODE_OPTIONS)[number]["value"];

export interface CallTrackingGeneralSettings {
  outgoingCallType: CallType | null;
  incomingCallType: CallType | null;
  callProviderMode: CallProviderMode | null;
}

export interface CallStatusRow {
  /** The provider's own status. Immutable — this screen renames only the label. */
  providerStatus: string;
  defaultName: string;
  customName: string;
}

export function fetchCallTrackingGeneral(
  signal?: AbortSignal,
): Promise<CallTrackingGeneralSettings> {
  return apiGet<CallTrackingGeneralSettings>(
    "/settings/call-tracking/general",
    undefined,
    signal,
  );
}

export function saveCallTrackingGeneral(
  input: CallTrackingGeneralSettings,
): Promise<CallTrackingGeneralSettings> {
  return apiPut<CallTrackingGeneralSettings>(
    "/settings/call-tracking/general",
    input,
  );
}

export function fetchCallStatuses(
  signal?: AbortSignal,
): Promise<CallStatusRow[]> {
  return apiGet<CallStatusRow[]>(
    "/settings/call-tracking/call-statuses",
    undefined,
    signal,
  );
}

/** The provider status travels in the path precisely because it cannot be edited. */
export function saveCallStatus(
  providerStatus: string,
  customName: string,
): Promise<CallStatusRow[]> {
  return apiPatch<CallStatusRow[]>(
    `/settings/call-tracking/call-statuses/${providerStatus}`,
    { customName },
  );
}
