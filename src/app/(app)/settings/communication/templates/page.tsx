import type { Metadata } from "next";
import { TemplatesView } from "@/components/settings/communication/templates-view";

export const metadata: Metadata = { title: "Templates - Emarath" };

/**
 * Settings → Communication → Templates, backed by `/api/message-templates`. The two-pane
 * settings frame comes from the Communication layout, so this page renders only the card.
 */
export default function CommunicationTemplatesPage() {
  return <TemplatesView />;
}
