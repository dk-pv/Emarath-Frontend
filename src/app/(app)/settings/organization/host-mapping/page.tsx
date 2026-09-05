import type { Metadata } from "next";
import { OrganizationHostMappingView } from "@/components/settings/organization/organization-host-mapping-view";

export const metadata: Metadata = { title: "Host Mapping - Emarath" };

/**
 * Settings → Organization Setup → Host Mapping, backed by
 * `/api/settings/organization/host-mapping`. The two-pane settings frame comes from the
 * Organization layout, so this page renders only the card.
 */
export default function OrganizationHostMappingPage() {
  return <OrganizationHostMappingView />;
}
