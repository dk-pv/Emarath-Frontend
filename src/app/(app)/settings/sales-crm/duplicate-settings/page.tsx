import type { Metadata } from "next";
import { DuplicateSettingsView } from "@/components/settings/sales-crm/duplicate-settings-view";

export const metadata: Metadata = { title: "Duplicate Settings - Emarath" };

/**
 * Settings → Sales & CRM Configuration → Duplicate Settings, backed by
 * `/api/settings/sales-crm/duplicate`. The two-pane settings frame comes from the
 * Sales & CRM layout, so this page renders only its own heading and card.
 */
export default function DuplicateSettingsPage() {
  return <DuplicateSettingsView />;
}
