import type { Metadata } from "next";
import { LeadSourcesView } from "@/components/settings/sales-crm/lead-sources-view";

export const metadata: Metadata = { title: "Lead Source - Emarath" };

/**
 * Settings → Sales & CRM Configuration → Lead Source, backed by `/api/lead-sources`.
 * The two-pane settings frame comes from the Sales & CRM layout, so this page renders
 * only the card.
 */
export default function LeadSourcePage() {
  return <LeadSourcesView />;
}
