import type { Metadata } from "next";
import { CommunicationAlertsView } from "@/components/settings/communication/communication-alerts-view";

export const metadata: Metadata = { title: "Emarath Alerts - Emarath" };

/**
 * Settings → Communication → Emarath Alerts, backed by
 * `/api/settings/communication/alerts`. The two-pane settings frame comes from the
 * Communication layout, so this page renders only the card.
 */
export default function CommunicationAlertsPage() {
  return <CommunicationAlertsView />;
}
