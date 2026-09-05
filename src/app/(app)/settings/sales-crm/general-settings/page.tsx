import type { Metadata } from "next";
import { GeneralSettingsView } from "@/components/settings/sales-crm/general-settings-view";

export const metadata: Metadata = { title: "General Settings - Emarath" };

/**
 * Settings → Sales & CRM Configuration → General Settings, backed by
 * `GET/PUT /api/settings/sales-crm/general`. The two-pane settings frame comes from the
 * Sales & CRM layout, so this page renders only the card.
 */
export default function SalesCrmGeneralSettingsPage() {
  return <GeneralSettingsView />;
}
