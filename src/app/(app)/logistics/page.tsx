import { Suspense } from "react";
import { LogisticsView } from "@/components/logistics/logistics-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/logistics");

/**
 * The Logistics screen. Its view, filters and open order live in the URL — the Lead Detail page
 * links an order with `?order=` — so it reads them under Suspense.
 */
export default function LogisticsPage() {
  return (
    <Suspense>
      <LogisticsView />
    </Suspense>
  );
}
