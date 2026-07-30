import { IconLayoutDashboard } from "@tabler/icons-react";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { EmptyState } from "@/components/ui/EmptyState";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/dashboard");

/**
 * The Dashboard is the default landing area (FND-02.2), but its metrics — KPI cards,
 * the Sales Team Activity Board and the leaderboard — are the Dashboard module (DASH-*,
 * Sprint 5), which has no backend yet. Rather than fabricate figures, the route shows an
 * honest empty state until that module is built.
 */
export default function DashboardPage() {
  return (
    <ContentContainer className="p-4 lg:p-6">
      <div className="flex min-h-[60vh] items-center justify-center">
        <EmptyState
          icon={IconLayoutDashboard}
          title="Dashboard is not available yet"
          description="Dashboard metrics arrive with the Dashboard module (Sprint 5). No figures are shown until real data is available."
        />
      </div>
    </ContentContainer>
  );
}
