import type { Metadata } from "next";
import { CategoriesView } from "@/components/settings/sales-crm/categories-view";

export const metadata: Metadata = { title: "Category - Emarath" };

/**
 * Settings → Sales & CRM Configuration → Category, backed by `/api/categories`. The
 * two-pane settings frame comes from the Sales & CRM layout, so this page renders only
 * the card.
 */
export default function CategoryPage() {
  return <CategoriesView />;
}
