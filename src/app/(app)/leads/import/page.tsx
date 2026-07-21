import type { Metadata } from "next";
import { ImportWizard } from "@/components/leads/import/import-wizard";

export const metadata: Metadata = { title: "Import Leads - Emarath" };

export default function ImportLeadsPage() {
  return <ImportWizard />;
}
