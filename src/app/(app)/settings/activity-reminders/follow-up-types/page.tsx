import type { Metadata } from "next";
import { FollowUpTypesView } from "@/components/settings/activity-reminders/follow-up-types-view";

export const metadata: Metadata = { title: "Follow Up Types - Emarath" };

/**
 * Settings → Activity and Reminders → Follow Up Types, backed by
 * `/api/settings/activity-reminders/follow-up-types`. The two-pane settings frame comes
 * from the category layout, so this page renders only the card.
 */
export default function FollowUpTypesPage() {
  return <FollowUpTypesView />;
}
