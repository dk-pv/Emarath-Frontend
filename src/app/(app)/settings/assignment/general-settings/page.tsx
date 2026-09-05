import type { Metadata } from "next";
import { AssignmentGeneralView } from "@/components/settings/assignment/assignment-general-view";

export const metadata: Metadata = { title: "Assignment Settings - Emarath" };

/**
 * Settings → Assignment → General Settings, backed by
 * `/api/settings/assignment/general`. The two-pane settings frame comes from the
 * Assignment layout, so this page renders only the card.
 */
export default function AssignmentGeneralSettingsPage() {
  return <AssignmentGeneralView />;
}
