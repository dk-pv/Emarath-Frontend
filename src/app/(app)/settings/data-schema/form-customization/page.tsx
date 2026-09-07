import type { Metadata } from "next";
import { FormCustomizationView } from "@/components/settings/data-schema/form-customization-view";

export const metadata: Metadata = { title: "Form Customization - Emarath" };

/**
 * Settings → Data & Schema Management → Form Customization, backed by `/api/lead-forms`.
 * The two-pane settings frame comes from the category layout, so this page renders only
 * the card.
 */
export default function FormCustomizationPage() {
  return <FormCustomizationView />;
}
