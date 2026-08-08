import { routeMetadata } from "@/lib/route-metadata";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { getDashboardData } from "@/services/dashboard-service";

export const metadata = routeMetadata("/dashboard");

export default function DashboardPage() {
  return <DashboardView data={getDashboardData()} />;
}
