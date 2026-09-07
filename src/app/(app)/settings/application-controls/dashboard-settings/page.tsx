import type { Metadata } from "next";
import { DashboardSettingsView } from "@/components/settings/application-controls/dashboard-settings-view";

export const metadata: Metadata = { title: "Dashboard Settings - Emarath" };

/**
 * Settings → Application Controls → Dashboard Settings, backed by
 * `/api/settings/application-controls/dashboard`. The two-pane frame comes from the
 * category layout, so this page renders only the card.
 */
export default function DashboardSettingsPage() {
  return <DashboardSettingsView />;
}
