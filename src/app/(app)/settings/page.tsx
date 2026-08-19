import { routeMetadata } from "@/lib/route-metadata";
import { PageContainer } from "@/components/layout/PageContainer";
import { SettingsHub } from "@/components/settings/settings-hub";

export const metadata = routeMetadata("/settings");

/**
 * Settings — a navigation-only hub matching the Workpex Settings layout (see
 * `ui-reference/settings/`). A full Settings management screen is out of backlog scope
 * (FND-04.2); this lists the information architecture and wires nothing to a backend. The
 * Navbar renders the "Settings" title from the nav config.
 */
export default function SettingsPage() {
  return (
    <PageContainer>
      <SettingsHub />
    </PageContainer>
  );
}
