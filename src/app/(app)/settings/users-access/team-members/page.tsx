import type { Metadata } from "next";
import { TeamMembersView } from "@/components/settings/team-members/team-members-view";

export const metadata: Metadata = { title: "Team Members - Emarath" };

/**
 * Settings → Users & Access → Team Members: the staff roster, backed by `GET /api/users`.
 * The Navbar still reads "Settings" because `matchNavItem` resolves this path to the
 * Settings nav entry, which is what the reference shows.
 */
export default function TeamMembersPage() {
  return <TeamMembersView />;
}
