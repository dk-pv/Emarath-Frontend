import { routeMetadata } from "@/lib/route-metadata";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReportsHub } from "@/components/reports/reports-hub";

export const metadata = routeMetadata("/analytics");

/**
 * Analytics hub: the Sales reports that live under Workpex's Analytics module (not Reports) —
 * Sales Funnel Report, Sales Pipeline Analysis and Revenue Report. Reuses the Reports hub chrome
 * (collapsible, per-category-searchable card sections); the Navbar renders the "Analytics" title.
 * Navigation only — each card links to its report screen (future). See
 * `ui-reference/analytics/analytics-hub-sales-reports-default.png`.
 */
export default function AnalyticsPage() {
  return (
    <PageContainer>
      <ReportsHub variant="analytics" />
    </PageContainer>
  );
}
