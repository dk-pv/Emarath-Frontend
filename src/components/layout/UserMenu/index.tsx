"use client";

import { IconDownload, IconLock, IconLogout } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Dropdown } from "@/components/ui/Dropdown";

/**
 * Traced from ui-reference/dashboard/dashboard-avatar-user-menu-open.png: an identity
 * header (rounded-square avatar, name, phone), a rule, then an "Account" group with
 * Update Password / Import Data / Log Out.
 *
 * The signed-in identity is not available until Authentication lands (AUTH-01.x), so the
 * header shows a neutral placeholder rather than a fabricated name/phone. The actions are
 * wired by their own backlog tasks — this owns the menu only.
 */
export function UserMenu() {
  return (
    <Dropdown
      align="end"
      trigger={
        <span className="block rounded-full focus-ring" aria-label="Account">
          <Avatar name="Account" />
        </span>
      }
      items={[
        {
          type: "custom",
          id: "identity",
          content: (
            <div className="flex items-center gap-3 px-4 py-3">
              <Avatar name="Account" shape="square" />
              <span className="min-w-0">
                <span className="block truncate text-[15px] font-medium text-ink">
                  Account
                </span>
                <span className="block truncate text-[13px] text-ink-muted">
                  Sign-in arrives with Authentication
                </span>
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
        { type: "item", id: "logout", label: "Log Out", icon: IconLogout },
      ]}
    />
  );
}
