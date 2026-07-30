"use client";

import { IconBell } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Popover } from "@/components/ui/Popover";

/**
 * The bell's panel is not captured in ui-reference/, so this renders the measured
 * trigger (icon only) and an empty panel rather than inventing a feed. There is no
 * notifications backend yet, so no unread count is shown — a fabricated badge would
 * claim data that does not exist. The Notification Center is a separate, deferred
 * backlog task.
 */
export function NotificationMenu() {
  return (
    <Popover
      align="end"
      trigger={
        <span
          aria-label="Notifications"
          className="relative flex size-control shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring"
        >
          <IconBell size={23} stroke={1.75} />
        </span>
      }
    >
      <div className="w-80">
        <EmptyState
          icon={IconBell}
          title="Notifications"
          description="The notification panel is not part of this task."
        />
      </div>
    </Popover>
  );
}
