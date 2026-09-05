import type { Metadata } from "next";
import { PipelinesView } from "@/components/settings/sales-crm/pipelines-view";

export const metadata: Metadata = { title: "Sales Pipeline - Emarath" };

/**
 * Settings → Sales & CRM Configuration → Sales Pipeline, backed by `/api/pipelines`.
 * The two-pane settings frame comes from the Sales & CRM layout, so this page renders
 * only the card.
 */
export default function SalesPipelinePage() {
  return <PipelinesView />;
}
