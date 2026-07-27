import { routeMetadata } from "@/lib/route-metadata";
import { CallDashboardView } from "@/components/calls/call-dashboard-view";

export const metadata = routeMetadata("/calls");

/** The Call Dashboard: summary KPIs (CALL-03.2) + leaderboard (CALL-04.2); log follows. */
export default function CallDashboardPage() {
  return <CallDashboardView />;
}
