import { LogisticsListView } from "@/components/logistics/logistics-list-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/logistics");

export default function LogisticsPage() {
  return <LogisticsListView />;
}
