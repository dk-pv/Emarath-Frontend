import { Suspense } from "react";
import { routeMetadata } from "@/lib/route-metadata";
import { ActivitiesListView } from "@/components/activities/activities-list-view";

export const metadata = routeMetadata("/activities");

/**
 * The Activities worklist (ACT-02.2). The view reads its opening tab and assignee from the
 * URL — a report's drill-through link sets them — so it sits under Suspense.
 */
export default function ActivitiesPage() {
  return (
    <Suspense>
      <ActivitiesListView />
    </Suspense>
  );
}
