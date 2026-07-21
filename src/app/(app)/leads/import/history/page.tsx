import type { Metadata } from "next";
import { ImportHistoryView } from "@/components/leads/import/import-history-view";

export const metadata: Metadata = { title: "Import History - Emarath" };

export default function ImportHistoryPage() {
  return <ImportHistoryView />;
}
