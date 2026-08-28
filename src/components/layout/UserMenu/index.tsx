"use client";

import { useRouter } from "next/navigation";
import { IconDownload, IconLock, IconLogout } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";
import { useAuth } from "@/components/auth/auth-context";
import { initialsOf } from "@/lib/format";

/**
 * Traced from ui-reference/dashboard/dashboard-avatar-user-menu-open.png: an identity
 * header (rounded-square avatar, name, secondary line), a rule, then an "Account" group
 * with Update Password / Import Data / Log Out.
 *
 * Identity now comes from the AuthProvider (AUTH-01.6 Phase 3): the header shows the real
 * name, email and role, and Log Out ends the session and returns to /login. Update Password
 * and Import Data are wired by their own backlog tasks — this owns the menu and logout only.
 */

/** Formats a UserRole enum value (`SALES_AGENT`) as a readable label (`Sales Agent`). */
function formatRole(role: string): string {
  return role
    .toLowerCase()
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
}

export function UserMenu() {
  const { user, logout } = useAuth();
  const router = useRouter();

  // Rendered inside the authenticated shell (behind RequireAuth), so `user` is present;
  // fall back defensively rather than assuming it.
  const name = user?.name ?? "Account";
  const email = user?.email ?? "";
  const initials = user ? initialsOf(name) || "?" : undefined;

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  return (
    <Dropdown
      align="end"
      trigger={
        <span className="block rounded-full focus-ring" aria-label={name}>
          <Avatar name={name} initials={initials} />
        </span>
      }
      items={[
        {
          type: "custom",
          id: "identity",
          content: (
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar name={name} initials={initials} shape="square" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-ink">
                  {name}
                </span>
                {email && (
                  <span className="block truncate text-[13px] text-ink-muted">
                    {email}
                  </span>
                )}
                {user && (
                  <span className="mt-0.5 block text-[12px] font-medium tracking-wide text-brand-strong">
                    {formatRole(user.role)}
                  </span>
                )}
              </span>
            </div>
          ),
        },
        { type: "separator", id: "sep" },
        { type: "label", id: "account", label: "Account" },
        {
          type: "item",
          id: "update-password",
          label: "Update Password",
          icon: IconLock,
        },
        {
          type: "item",
          id: "import-data",
          label: "Import Data",
          icon: IconDownload,
        },
        {
          type: "item",
          id: "logout",
          label: "Log Out",
          icon: IconLogout,
          onSelect: () => {
            void handleLogout();
          },
        },
      ]}
    />
  );
}
