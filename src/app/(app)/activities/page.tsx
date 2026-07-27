import { routeMetadata } from "@/lib/route-metadata";
import { ActivitiesListView } from "@/components/activities/activities-list-view";

export const metadata = routeMetadata("/activities");

/** The Activities worklist (ACT-02.2). */
export default function ActivitiesPage() {
  return <ActivitiesListView />;
}
