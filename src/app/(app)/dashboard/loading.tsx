import { Skeleton } from "@/components/ui/Skeleton";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { DashboardKpiCarouselSkeleton } from "@/components/dashboard/dashboard-kpi-carousel";

export default function DashboardLoading() {
  return (
    <ContentContainer>
      <div className="flex justify-end">
        <Skeleton className="h-9 w-36 rounded-full" />
      </div>
      <DashboardKpiCarouselSkeleton />
      <Skeleton className="h-[420px] w-full rounded-surface" />
    </ContentContainer>
  );
}
