import { apiGet, apiPut } from "@/lib/api-client";

/**
 * Settings → Application Controls.
 *
 * Two JSON rows in `app_settings`, read and written exactly as every other settings
 * screen is. The Dashboard's own configured summary lives in `dashboard-service`, which
 * is what actually consumes the second of them.
 */
export interface ApplicationGeneralSettings {
  autoSavePassword: boolean;
  disablePromptAfterCall: boolean;
  selfieVerificationOnLogin: boolean;
}

export const SUMMARY_MODES = ["LEAD_STAGE", "LEAD_SOURCE"] as const;
export type SummaryMode = (typeof SUMMARY_MODES)[number];

export const DISPLAY_ON_CARDS = ["BOTH", "LEAD_COUNT", "AMOUNT"] as const;
export type DisplayOnCards = (typeof DISPLAY_ON_CARDS)[number];

/** The reference's option labels, in the order its dropdown lists them. */
export const DISPLAY_ON_CARDS_LABELS: Record<DisplayOnCards, string> = {
  BOTH: "Both",
  LEAD_COUNT: "Lead Count",
  AMOUNT: "Amount",
};

export interface DashboardCardConfig {
  fieldKey: string;
  position: number;
}

export interface DashboardSettings {
  summaryMode: SummaryMode;
  displayOnCards: DisplayOnCards;
  leadStage: DashboardCardConfig[];
  leadSource: DashboardCardConfig[];
}

export interface DashboardFieldOption {
  fieldKey: string;
  label: string;
}

export interface DashboardFieldCatalogue {
  leadStage: DashboardFieldOption[];
  leadSource: DashboardFieldOption[];
}

export function fetchApplicationGeneral(
  signal?: AbortSignal,
): Promise<ApplicationGeneralSettings> {
  return apiGet<ApplicationGeneralSettings>(
    "/settings/application-controls/general",
    undefined,
    signal,
  );
}

export function saveApplicationGeneral(
  input: ApplicationGeneralSettings,
): Promise<ApplicationGeneralSettings> {
  return apiPut<ApplicationGeneralSettings>(
    "/settings/application-controls/general",
    input,
  );
}

export function fetchDashboardSettings(
  signal?: AbortSignal,
): Promise<DashboardSettings> {
  return apiGet<DashboardSettings>(
    "/settings/application-controls/dashboard",
    undefined,
    signal,
  );
}

export function fetchDashboardFields(
  signal?: AbortSignal,
): Promise<DashboardFieldCatalogue> {
  return apiGet<DashboardFieldCatalogue>(
    "/settings/application-controls/dashboard/fields",
    undefined,
    signal,
  );
}

export function saveDashboardSettings(
  input: DashboardSettings,
): Promise<DashboardSettings> {
  return apiPut<DashboardSettings>(
    "/settings/application-controls/dashboard",
    input,
  );
}

/**
 * The one Application Controls value the login screen may read before a session exists.
 *
 * Its own unauthenticated route, so a failure here must never block signing in — the
 * caller treats an unreachable policy as "unset" and the form behaves as it always has.
 */
export interface LoginPolicy {
  autoSavePassword: boolean;
}

export function fetchLoginPolicy(signal?: AbortSignal): Promise<LoginPolicy> {
  return apiGet<LoginPolicy>(
    "/settings/application-controls/login-policy",
    undefined,
    signal,
  );
}
