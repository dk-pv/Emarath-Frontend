import { routeMetadata } from "@/lib/route-metadata";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReportsHub } from "@/components/reports/reports-hub";

export const metadata = routeMetadata("/reports");

/**
 * Reports hub (RPT-01.1): a library of pre-built reports grouped into collapsible,
 * per-category-searchable sections. Navigation only — each card links to its report screen,
 * which is built later (RPT-01.2+). The Navbar already renders the "Reports" page title.
 */
export default function ReportsPage() {
  return (
    <PageContainer>
      <ReportsHub />
    </PageContainer>
  );
}
