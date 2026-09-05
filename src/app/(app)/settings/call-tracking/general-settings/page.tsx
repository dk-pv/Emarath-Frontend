import type { Metadata } from "next";
import { CallTrackingGeneralView } from "@/components/settings/call-tracking/call-tracking-general-view";

export const metadata: Metadata = { title: "Call Tracking Settings - Emarath" };

/**
 * Settings → Call Tracking → General Settings, backed by
 * `/api/settings/call-tracking/general`. The two-pane settings frame comes from the Call
 * Tracking layout, so this page renders only the card.
 */
export default function CallTrackingGeneralSettingsPage() {
  return <CallTrackingGeneralView />;
}
