"use client";

import { IconBell } from "@tabler/icons-react";
import { EmptyState } from "@/components/ui/EmptyState";
import { Popover } from "@/components/ui/Popover";

/**
 * The bell's panel.
 *
 * The reference's feed is an **activity** stream — "a new lead X was added by Y",
 * "X was assigned to Y", "a lead has been won" — and this product has nothing that
 * produces those. The one notification concept in the approved backlog is FND-05.1's
 * alerts service, which is explicitly *system*-level (integration failures, quota
 * warnings) and already surfaces on the Dashboard as the System Alerts panel. There
 * is no per-user activity feed, no unread state and no endpoint behind this bell.
 *
 * So the panel stays an honest empty state and the bell carries no count: a badge
 * here would have to invent a number, and rows would have to invent events.
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
          <IconBell size={21} stroke={1.75} />
        </span>
      }
    >
      <div className="w-80">
        <EmptyState
          icon={IconBell}
          title="Notifications"
          description="You have no notifications."
        />
      </div>
    </Popover>
  );
}
