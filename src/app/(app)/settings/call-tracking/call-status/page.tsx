import type { Metadata } from "next";
import { CallStatusesView } from "@/components/settings/call-tracking/call-statuses-view";

export const metadata: Metadata = { title: "Call Status - Emarath" };

/**
 * Settings → Call Tracking → Call Status, backed by
 * `/api/settings/call-tracking/call-statuses`. The two-pane settings frame comes from the
 * Call Tracking layout, so this page renders only the card.
 */
export default function CallStatusPage() {
  return <CallStatusesView />;
}
