import type { Metadata } from "next";
import { AssignmentRulesView } from "@/components/settings/assignment/assignment-rules-view";

export const metadata: Metadata = { title: "Assignment Rules - Emarath" };

/**
 * Settings → Assignment → Assignment Rules, backed by `/api/assignment-rules`. The
 * two-pane settings frame comes from the Assignment layout, so this page renders only
 * the card.
 */
export default function AssignmentRulesPage() {
  return <AssignmentRulesView />;
}
