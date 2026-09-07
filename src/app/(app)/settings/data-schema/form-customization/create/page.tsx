import type { Metadata } from "next";
import { LeadFormBuilder } from "@/components/settings/data-schema/lead-form-builder";

export const metadata: Metadata = { title: "Add Lead Form - Emarath" };

/**
 * Settings → Data & Schema Management → Form Customization → Add Lead Form. Its own
 * route, as the reference gives it (`…/form-customization/create`); the two-pane settings
 * frame comes from the category layout.
 */
export default function AddLeadFormPage() {
  return <LeadFormBuilder />;
}
