import type { Metadata } from "next";
import { TagsView } from "@/components/settings/sales-crm/tags-view";

export const metadata: Metadata = { title: "Tags - Emarath" };

/**
 * Settings → Sales & CRM Configuration → Tags, backed by `/api/tags`. The two-pane
 * settings frame comes from the Sales & CRM layout, so this page renders only the card.
 */
export default function TagsPage() {
  return <TagsView />;
}
