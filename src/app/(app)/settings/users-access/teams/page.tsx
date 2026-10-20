import type { Metadata } from "next";
import { TeamsView } from "@/components/settings/teams/teams-view";

export const metadata: Metadata = { title: "Teams - Emarath" };

/**
 * Settings → Users & Access → Teams (Teams v1): the BDE teams over `User.team`, backed by
 * `/api/teams` (Super Admin only).
 */
export default function TeamsPage() {
  return <TeamsView />;
}
