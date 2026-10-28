import { routeMetadata } from "@/lib/route-metadata";
import { AnalyticsHub } from "@/components/reports/analytics-hub";

export const metadata = routeMetadata("/analytics");

/**
 * Analytics hub: the Sales reports that live under Workpex's Analytics module (not Reports) —
 * Sales Funnel Report, Sales Pipeline Analysis and Revenue Report (User Scorecard is registered but
 * not listed). Not wrapped in PageContainer: the hub's category bar runs edge to edge under the
 * navbar, so the hub pads its own rows. The Navbar renders the "Analytics" title. Navigation only —
 * each card links to its report screen (future). See
 * `ui-reference/analytics/analytics-hub-available-categories-default.png`.
 */
export default function AnalyticsPage() {
  return <AnalyticsHub />;
}
