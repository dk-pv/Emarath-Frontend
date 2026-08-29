"use client";

import { useEffect, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { IconClock } from "@tabler/icons-react";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { followUpEvents } from "@/components/leads/lead-detail-drawer";
import {
  fetchLeadActivities,
  fetchLeadTimeline,
  type LeadListItem,
  type LeadTimelineEvent,
} from "@/services/leads-service";

/**
 * The lead's activity timeline, opened from the ↗ beside a Customer Name.
 *
 * Deliberately not a second history system: it renders the same `LeadTimeline`
 * component the Lead Detail drawer renders, from the same two endpoints
 * (`GET /leads/:id/timeline` plus `GET /leads/:id/activities`, merged by the
 * drawer's own `followUpEvents`). Only the shell is new — a drawer instead of a
 * detail panel — because the worklist has no lead detail context to open into.
 */
export function ActivityTimelineDrawer({
  lead,
  onClose,
}: {
  lead: LeadListItem;
  onClose: () => void;
}) {
  const [state, setState] = useState<{
    status: "loading" | "ready" | "error";
    events: LeadTimelineEvent[];
  }>({ status: "loading", events: [] });
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([
      fetchLeadTimeline(lead.id, controller.signal),
      fetchLeadActivities(lead.id, controller.signal),
    ])
      .then(([timeline, activities]) => {
        // Newest first, exactly as the detail drawer orders the merged feed.
        const events = [...timeline, ...followUpEvents(activities)].sort(
          (a, b) => b.at.localeCompare(a.at),
        );
        setState({ status: "ready", events });
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setState({ status: "error", events: [] });
      });
    return () => controller.abort();
  }, [lead.id, reloadToken]);

  return (
    <Drawer open onClose={onClose} title={lead.name} width="max-w-xl">
      {state.status === "loading" && (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      )}

      {state.status === "error" && (
        <ErrorState
          title="Couldn’t load the timeline"
          description="Something went wrong while loading this lead's activity history."
          onRetry={() => {
            setState({ status: "loading", events: [] });
            setReloadToken((token) => token + 1);
          }}
        />
      )}

      {state.status === "ready" &&
        (state.events.length === 0 ? (
          <EmptyState
            icon={IconClock}
            title="No activity yet"
            description="This lead has no recorded history."
          />
        ) : (
          <LeadTimeline events={state.events} />
        ))}
    </Drawer>
  );
}
