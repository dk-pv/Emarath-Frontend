import { LeadsListView } from "@/components/leads/leads-list-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/leads");

export default function LeadsPage() {
  return <LeadsListView />;
}
