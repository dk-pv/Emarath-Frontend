import type { Metadata } from "next";
import { ActivityGeneralView } from "@/components/settings/activity-reminders/activity-general-view";

export const metadata: Metadata = {
  title: "Activity and Reminders Settings - Emarath",
};

/**
 * Settings → Activity and Reminders → General Settings, backed by
 * `/api/settings/activity-reminders/general`. The two-pane settings frame comes from the
 * category layout, so this page renders only the card.
 */
export default function ActivityGeneralSettingsPage() {
  return <ActivityGeneralView />;
}
