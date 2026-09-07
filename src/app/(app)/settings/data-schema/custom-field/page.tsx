import type { Metadata } from "next";
import { CustomFieldsView } from "@/components/settings/data-schema/custom-fields-view";

export const metadata: Metadata = { title: "Custom Field - Emarath" };

/**
 * Settings → Data & Schema Management → Custom Field, backed by
 * `/api/lead-custom-fields`. The two-pane settings frame comes from the category layout,
 * so this page renders only the card.
 */
export default function CustomFieldPage() {
  return <CustomFieldsView />;
}
