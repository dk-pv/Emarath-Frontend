import { routeMetadata } from "@/lib/route-metadata";
import { GpsMapScreen } from "@/components/gps/gps-map-screen";

export const metadata = routeMetadata("/map");

/** The GPS Map screen: field-activity KPIs (GPS-04.2) + the live map (GPS-05.1). */
export default function GpsMapPage() {
  return <GpsMapScreen />;
}
