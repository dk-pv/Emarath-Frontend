import { Skeleton } from "@/components/ui/Skeleton";
import { ContentContainer } from "@/components/layout/ContentContainer";

export default function DashboardLoading() {
  return (
    <ContentContainer className="p-4 lg:p-6">
      <Skeleton className="h-[60vh] w-full rounded-surface" />
    </ContentContainer>
  );
}
