import { apiGet, apiPut } from "@/lib/api-client";
import type { UserRole } from "@/services/users-service";

/**
 * Settings → Sales & CRM Configuration → General Settings, as
 * `GET /api/settings/sales-crm/general` returns it.
 *
 * The API always answers with a complete payload — a screen that has never been saved
 * returns the shipped defaults rather than nulls, so the form never has to invent a
 * starting value.
 */
export interface SalesCrmGeneralSettings {
  displayLeads: "ALL_LEADS";
  displayOrder: "BY_DATE";
  orderBy: "LAST_CREATED_DATE" | "LAST_EDITED_DATE";
  requireCompanyName: boolean;
  noteDisplay: "LEAD_PRIMARY_NOTE" | "LAST_ADDED_NOTE";
  fieldNames: CustomFieldNames;
  actualAmountTimeline: boolean;
  /** ISO 3166-1 alpha-2, matching `@/constants/countries`. */
  defaultCountryCode: string;
  tagPermission: "ALL_USERS";
  maskMobileNumbers: boolean;
  /** Which role still sees unmasked numbers; null while masking is off. */
  maskingRole: UserRole | null;
  maskDigits: number;
  pipelineChangeAssignee: "SAME_USER" | "UNASSIGN";
  noActivityThreshold: number;
  noActivityUnit: "HOURS";
  noActivityNotifications: boolean;
}

/** The display labels the app uses for eight built-in Lead fields. */
export interface CustomFieldNames {
  state: string;
  district: string;
  city: string;
  zipcode: string;
  actualAmount: string;
  forecastedAmount: string;
  tag: string;
  category: string;
}

export function fetchSalesCrmGeneral(
  signal?: AbortSignal,
): Promise<SalesCrmGeneralSettings> {
  return apiGet<SalesCrmGeneralSettings>(
    "/settings/sales-crm/general",
    undefined,
    signal,
  );
}

/**
 * Replaces the whole payload — the form always sends every field, because a partial body
 * would reset whatever it omitted. Returns what the server actually stored, which is what
 * the form then treats as its saved baseline.
 */
export function saveSalesCrmGeneral(
  settings: SalesCrmGeneralSettings,
): Promise<SalesCrmGeneralSettings> {
  return apiPut<SalesCrmGeneralSettings>(
    "/settings/sales-crm/general",
    settings,
  );
}
