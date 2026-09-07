import type { Metadata } from "next";
import { LeadFormBuilder } from "@/components/settings/data-schema/lead-form-builder";

export const metadata: Metadata = { title: "Edit Lead Form - Emarath" };

/** The same builder, seeded from the saved form. */
export default async function EditLeadFormPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadFormBuilder formId={id} />;
}
