import type { Metadata } from "next";
import { ApplicationGeneralView } from "@/components/settings/application-controls/application-general-view";

export const metadata: Metadata = {
  title: "Application General Settings - Emarath",
};

/**
 * Settings → Application Controls → Application General Settings, backed by
 * `/api/settings/application-controls/general`. The two-pane frame comes from the
 * category layout, so this page renders only the card.
 */
export default function ApplicationGeneralSettingsPage() {
  return <ApplicationGeneralView />;
}
