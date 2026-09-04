import type { Metadata } from "next";
import { RolesPermissionsView } from "@/components/settings/roles-permissions/roles-permissions-view";

export const metadata: Metadata = { title: "Roles & Permissions - Emarath" };

/**
 * Settings → Users & Access → Roles & Permissions, backed by `GET /api/roles` (ADR-0056).
 * The two-pane settings frame comes from the Users & Access layout, so this page renders
 * only the card.
 */
export default function RolesPermissionsPage() {
  return <RolesPermissionsView />;
}
