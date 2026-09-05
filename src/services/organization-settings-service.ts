import { apiGet, apiPut } from "@/lib/api-client";

/**
 * Settings → Organization Setup → General Settings.
 *
 * One JSON row in `app_settings`, read and written exactly as the Sales & CRM settings
 * screens are. The vocabularies below mirror `organization-general.dto.ts` so the offered
 * options and the accepted values cannot drift; the currency catalogue is the exception —
 * it is 156 entries, so it is fetched from `GET /api/lookups/currencies` rather than
 * duplicated here (ADR-0065).
 */

export const DATE_DISPLAY_FORMATS = [
  "D, d M Y",
  "d-m-Y",
  "d/m/Y",
  "m-d-Y",
  "m/d/Y",
  "Y-m-d",
  "Y/m/d",
  "Y-d-m",
  "Y/d/m",
] as const;
export type DateDisplayFormat = (typeof DATE_DISPLAY_FORMATS)[number];

export const PAGINATION_LIMITS = [10, 20, 50, 100] as const;
export type PaginationLimit = (typeof PAGINATION_LIMITS)[number];

/** Sunday first, as the reference's Off Days dropdown lists them. */
export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;
export type Weekday = (typeof WEEKDAYS)[number];

export const MERIDIEMS = ["AM", "PM"] as const;
export type Meridiem = (typeof MERIDIEMS)[number];

/** The reference's shift controls: 1–12, 00–59, AM/PM. */
export const SHIFT_HOURS = Array.from({ length: 12 }, (_, i) => i + 1);
export const SHIFT_MINUTES = Array.from({ length: 60 }, (_, i) => i);

export interface OrganizationGeneralSettings {
  currency: string;
  dateDisplayFormat: DateDisplayFormat;
  tablePaginationLimit: PaginationLimit;
  organizationalGrouping: boolean;
  shiftStartHour: number;
  shiftStartMinute: number;
  shiftStartPeriod: Meridiem;
  shiftEndHour: number;
  shiftEndMinute: number;
  shiftEndPeriod: Meridiem;
  offDays: Weekday[];
  productModuleEnabled: boolean;
}

export function fetchOrganizationGeneral(
  signal?: AbortSignal,
): Promise<OrganizationGeneralSettings> {
  return apiGet<OrganizationGeneralSettings>(
    "/settings/organization/general",
    undefined,
    signal,
  );
}

export function saveOrganizationGeneral(
  input: OrganizationGeneralSettings,
): Promise<OrganizationGeneralSettings> {
  return apiPut<OrganizationGeneralSettings>(
    "/settings/organization/general",
    input,
  );
}
