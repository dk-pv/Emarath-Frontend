"use client";

import { IconBell } from "@tabler/icons-react";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { Popover } from "@/components/ui/Popover";
import { NOTIFICATION_COUNT } from "@/constants/dashboard";

/**
 * The bell's panel is not captured in ui-reference/, so this renders the measured
 * trigger (icon + count badge) and an empty panel rather than inventing a feed.
 * The Notification Center is a separate, deferred backlog task.
 */
export function NotificationMenu() {
  return (
    <Popover
      align="end"
      trigger={
        <span
          aria-label={`Notifications (${NOTIFICATION_COUNT} unread)`}
          className="relative flex size-control shrink-0 items-center justify-center rounded-full text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring"
        >
          <IconBell size={23} stroke={1.75} />
          {NOTIFICATION_COUNT > 0 && (
            <Badge
              tone="danger"
              className="absolute top-0 right-0 -translate-y-0.5 translate-x-0.5"
            >
              {NOTIFICATION_COUNT > 99 ? "99+" : NOTIFICATION_COUNT}
            </Badge>
          )}
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
