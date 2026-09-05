import type { Metadata } from "next";
import { OrganizationGeneralView } from "@/components/settings/organization/organization-general-view";

export const metadata: Metadata = { title: "General Settings - Emarath" };

/**
 * Settings → Organization Setup → General Settings, backed by
 * `/api/settings/organization/general`. The two-pane settings frame comes from the
 * Organization layout, so this page renders only the card.
 */
export default function OrganizationGeneralSettingsPage() {
  return <OrganizationGeneralView />;
}
