"use client";

import { IconHistory, IconLoader2 } from "@tabler/icons-react";
import { Drawer } from "@/components/ui/Drawer";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import type { LeadTimelineEvent } from "@/services/leads-service";

export type LeadTimelineDrawerProps = {
  open: boolean;
  onClose: () => void;
  leadName: string;
  /** The lead's timeline, or null while it is still loading. */
  events: LeadTimelineEvent[] | null;
  errored?: boolean;
  onRetry?: () => void;
};

/**
 * The lead's activity timeline, opened from the Basic Info header's Timeline control.
 *
 * The panel is only the frame: the entries themselves are the shared `LeadTimeline`, the
 * same component the Leads-list detail drawer renders, so the two can never drift. The
 * feed is `GET /leads/:id/timeline` — the lead's creation, assignments, notes and calls —
 * which the page has already fetched, so opening this costs no extra request.
 */
export function LeadTimelineDrawer({
  open,
  onClose,
  leadName,
  events,
  errored = false,
  onRetry,
}: LeadTimelineDrawerProps) {
  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={`Timeline – ${leadName}`}
      width="max-w-xl"
      header={
        <header className="border-b border-hairline p-4">
          <h2 className="text-base text-ink">
            Timeline –{" "}
            <span className="font-semibold underline decoration-1 underline-offset-2">
              {leadName}
            </span>
          </h2>
        </header>
      }
    >
      {errored ? (
        <ErrorState
          title="Couldn’t load the timeline"
          description="Something went wrong. Check your connection and try again."
          onRetry={onRetry ?? (() => {})}
        />
      ) : events === null ? (
        <div className="flex items-center justify-center py-10 text-ink-muted">
          <IconLoader2
            size={20}
            className="animate-spin"
            aria-label="Loading"
          />
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={IconHistory}
          title="Nothing yet"
          description="This lead has no recorded activity so far."
        />
      ) : (
        <LeadTimeline events={events} />
      )}
    </Drawer>
  );
}
