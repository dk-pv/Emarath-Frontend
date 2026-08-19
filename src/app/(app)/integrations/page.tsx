import { routeMetadata } from "@/lib/route-metadata";
import { PageContainer } from "@/components/layout/PageContainer";
import { IntegrationsLibrary } from "@/components/integrations/integrations-library";

export const metadata = routeMetadata("/integrations");

/**
 * Integrations (INT-02.1 / 02.2 / 02.3): the Integration Library — a filterable, searchable grid
 * of integration cards with per-card Enable toggles and a live enabled count. Traced from
 * `ui-reference/integrations/`. Data is a local seed set (the INT-01.1 backend registry is
 * pending); the Navbar renders the "Integrations" title from the nav config.
 */
export default function IntegrationsPage() {
  return (
    <PageContainer>
      <IntegrationsLibrary />
    </PageContainer>
  );
}
