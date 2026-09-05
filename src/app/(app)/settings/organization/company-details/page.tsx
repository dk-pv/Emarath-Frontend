import type { Metadata } from "next";
import { OrganizationCompanyView } from "@/components/settings/organization/organization-company-view";

export const metadata: Metadata = { title: "Company Details - Emarath" };

/**
 * Settings → Organization Setup → Company Details, backed by
 * `/api/settings/organization/company-details`. The two-pane settings frame comes from the
 * Organization layout, so this page renders only the card.
 */
export default function OrganizationCompanyDetailsPage() {
  return <OrganizationCompanyView />;
}
