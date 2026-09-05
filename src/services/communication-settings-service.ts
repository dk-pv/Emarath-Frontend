import { apiGet, apiPut } from "@/lib/api-client";

/**
 * Settings → Communication → Emarath Alerts.
 *
 * One JSON row in `app_settings`, read and written exactly as the Organization Setup
 * screens are. One switch, so one field — and today it is a stored preference and nothing
 * more: the System Alerts service that would produce alerts (FND-05.1) does not exist in
 * the codebase, and inventing producers to give the switch something to turn on was out
 * of scope (ADR-0068).
 */
export interface CommunicationAlertsSettings {
  alertsEnabled: boolean;
}

export function fetchCommunicationAlerts(
  signal?: AbortSignal,
): Promise<CommunicationAlertsSettings> {
  return apiGet<CommunicationAlertsSettings>(
    "/settings/communication/alerts",
    undefined,
    signal,
  );
}

export function saveCommunicationAlerts(
  input: CommunicationAlertsSettings,
): Promise<CommunicationAlertsSettings> {
  return apiPut<CommunicationAlertsSettings>(
    "/settings/communication/alerts",
    input,
  );
}
