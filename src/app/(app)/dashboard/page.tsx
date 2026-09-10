import { routeMetadata } from "@/lib/route-metadata";
import { DashboardView } from "@/components/dashboard/dashboard-view";

export const metadata = routeMetadata("/dashboard");

export default function DashboardPage() {
  return <DashboardView />;
}
