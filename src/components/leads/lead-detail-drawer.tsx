"use client";

import { useEffect, useState } from "react";
import {
  IconBrandWhatsapp,
  IconChevronRight,
  IconCircleCheck,
  IconEdit,
  IconLayoutGrid,
  IconLoader2,
  IconMail,
  IconPin,
  IconPinFilled,
  IconPlus,
  IconTrash,
  IconUserEdit,
} from "@tabler/icons-react";
import { Avatar } from "@/components/ui/Avatar";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { formatDateTime, initialsOf } from "@/lib/format";
import { whatsappUrl } from "@/lib/whatsapp";
import { LeadTimeline } from "@/components/leads/lead-timeline";
import { TYPE_LABEL } from "@/components/activities/activity-form-parts";
import {
  fetchLeadActivities,
  fetchLeadTimeline,
  type LeadActivity,
  type LeadListItem,
  type LeadTimelineEvent,
} from "@/services/leads-service";

/**
 * A lead's follow-ups become timeline entries on the client — one "created" event
 * always, plus a "completed" event when it has been completed — so a scheduled or
 * completed follow-up shows on the feed without a new backend timeline source. The
 * actor is not recorded on the activity, so it is deliberately absent.
 */
export function followUpEvents(
  activities: LeadActivity[],
): LeadTimelineEvent[] {
  return activities.flatMap((activity) => {
    const events: LeadTimelineEvent[] = [
      {
        id: `fu-created:${activity.id}`,
        type: "followup-created",
        at: activity.createdAt,
        activityType: activity.type,
        dueAt: activity.dueAt,
        description: activity.description,
      },
    ];
    if (activity.completedAt) {
      events.push({
        id: `fu-completed:${activity.id}`,
        type: "followup-completed",
        at: activity.completedAt,
        activityType: activity.type,
        dueAt: activity.dueAt,
        description: activity.description,
      });
    }
    return events;
  });
}

/** The bordered square icon buttons in the detail header (Workpex's action row). */
/** The header actions the detail drawer delegates to the list's existing flows. */
export type LeadDetailActions = {
  onPin: (lead: LeadListItem) => void;
  onWhatsapp: (lead: LeadListItem) => void;
  onEmail: (lead: LeadListItem) => void;
  onEdit: (lead: LeadListItem) => void;
  onReassign: (lead: LeadListItem) => void;
  onDelete: (lead: LeadListItem) => void;
  onAddNote: (lead: LeadListItem) => void;
  /** Opens the Add New Follow-up form for this lead (ACT-03.2). */
  onNewFollowUp: (lead: LeadListItem) => void;
  /** Confirms + completes the lead's next follow-up (ACT-04.1). */
  onCompleteFollowUp: (activity: LeadActivity) => void;
  /** Managers/admins only see Reassign (AUTH-02.2). */
  canReassign: boolean;
};

type LeadDetailDrawerProps = {
  open: boolean;
  lead: LeadListItem;
  actions: LeadDetailActions;
  /** Bumped by the parent after a note/reassign so the feed refetches. */
  refreshToken: number;
  onClose: () => void;
};

/**
 * The Workpex Lead Details drawer, opened by clicking a Customer Name in the Leads
 * list (traced from the four supplied Workpex screenshots; Lead-Detail-Blueprint).
 *
 * Reuses the shared `Drawer` (X off the left edge, slide-in) with a custom header
 * and a pinned top / self-scrolling timeline (`scrollBody={false}`). Every header
 * action delegates to the list's EXISTING flows via `actions` — Pin, WhatsApp,
 * Email, Edit (the shared New Lead form in edit mode), Reassign, Delete — with no
 * duplicate implementations. "Add Note" reuses the existing Add Note drawer
 * (ADR-0035). "New Follow-up" opens the Add New Follow-up form (ACT-03.2) via
 * `actions.onNewFollowUp`, and the Next Follow-up card completes the lead's next
 * follow-up (ACT-04.1) via `actions.onCompleteFollowUp` — both reuse the existing
 * activity APIs (no duplicates). The Timeline merges the honest `GET /leads/:id/timeline`
 * feed with the lead's follow-up create/complete events from `GET /leads/:id/activities`
 * — no invented events, and no actor where the system does not record one.
 */
export function LeadDetailDrawer({
  open,
  lead,
  actions,
  refreshToken,
  onClose,
}: LeadDetailDrawerProps) {
  // Results are tagged with the (lead + refresh + retry) key they answer and only
  // count when that key is current — so nothing is reset synchronously in the
  // effect and a slow earlier fetch can never repaint a newer lead (the
  // LeadDetailView pattern).
  const [retry, setRetry] = useState(0);
  const key = `${lead.id}:${refreshToken}:${retry}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    events: LeadTimelineEvent[];
    activities: LeadActivity[];
  } | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    Promise.all([
      fetchLeadTimeline(lead.id, controller.signal),
      fetchLeadActivities(lead.id, controller.signal),
    ])
      .then(([events, activities]) => {
        if (active) setLoaded({ key, events, activities });
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailedKey(key);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, lead.id]);

  const current = loaded?.key === key ? loaded : null;
  const failure = failedKey === key;
  // The feed is the honest server timeline plus this lead's follow-up create/complete
  // events, merged newest-first (ISO timestamps sort in time order).
  const timeline =
    current === null
      ? null
      : [...current.events, ...followUpEvents(current.activities)].sort(
          (a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0),
        );
  // Next Follow-up = the earliest still-incomplete follow-up (activities arrive
  // earliest-due first, so the first incomplete one is next).
  const nextFollowUp =
    current?.activities.find((activity) => !activity.completedAt) ?? null;
  const latestNote =
    timeline?.find(
      (event): event is Extract<LeadTimelineEvent, { type: "note" }> =>
        event.type === "note",
    ) ?? null;
  const waUrl = whatsappUrl(lead.primaryPhone);
  const pinned = lead.isPinned;

  const header = (
    <header className="flex items-center gap-3 border-b border-hairline p-4">
      <Avatar name={lead.name} initials={initialsOf(lead.name)} size="md" />
      <span className="flex min-w-0 items-center gap-1">
        <span className="truncate font-semibold text-ink underline decoration-1 underline-offset-2">
          {lead.name}
        </span>
        <IconChevronRight
          size={16}
          stroke={1.75}
          className="shrink-0 text-ink-muted"
          aria-hidden="true"
        />
      </span>

      <span className="ml-auto flex items-center gap-1.5">
        <Tooltip content={pinned ? "Unpin lead" : "Pin lead"}>
          <IconButton
            size="xl"
            variant="outline"
            aria-label={pinned ? "Unpin lead" : "Pin lead"}
            aria-pressed={pinned}
            onClick={() => actions.onPin(lead)}
            className={cn(pinned && "border-brand text-brand-strong")}
          >
            {pinned ? (
              <IconPinFilled size={18} stroke={1.75} aria-hidden="true" />
            ) : (
              <IconPin size={18} stroke={1.75} aria-hidden="true" />
            )}
          </IconButton>
        </Tooltip>

        <Tooltip content={waUrl ? "WhatsApp" : "No phone number"}>
          <IconButton
            size="xl"
            variant="outline"
            aria-label="WhatsApp"
            disabled={!waUrl}
            onClick={() => waUrl && actions.onWhatsapp(lead)}
          >
            <IconBrandWhatsapp size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>

        <Tooltip content="Email">
          <IconButton
            size="xl"
            variant="outline"
            aria-label="Email"
            onClick={() => actions.onEmail(lead)}
          >
            <IconMail size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>

        <Tooltip content="Edit Lead">
          <IconButton
            size="xl"
            variant="outline"
            aria-label="Edit Lead"
            onClick={() => actions.onEdit(lead)}
          >
            <IconEdit size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>

        {actions.canReassign && (
          <Tooltip content="Reassign">
            <IconButton
              size="xl"
              variant="outline"
              aria-label="Reassign"
              onClick={() => actions.onReassign(lead)}
            >
              <IconUserEdit size={18} stroke={1.75} aria-hidden="true" />
            </IconButton>
          </Tooltip>
        )}

        <Tooltip content="Delete">
          <IconButton
            size="xl"
            variant="outline"
            aria-label="Delete"
            onClick={() => actions.onDelete(lead)}
            tone="danger"
          >
            <IconTrash size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      </span>
    </header>
  );

  return (
    <Drawer
      open={open}
      onClose={onClose}
      title={lead.name}
      header={header}
      scrollBody={false}
      width="max-w-2xl"
    >
      <div className="flex h-full min-h-0 flex-col">
        <div className="flex-none border-b border-hairline px-5 py-5">
          <dl className="grid grid-cols-[minmax(96px,120px)_1fr] gap-x-6 gap-y-5">
            {nextFollowUp ? (
              <>
                <dt className="text-sm font-medium text-ink">Next Follow-up</dt>
                <dd>
                  <div className="flex items-center gap-2">
                    <span className="text-sm text-ink">
                      {formatDateTime(nextFollowUp.dueAt, { padHour: true })}
                    </span>
                    <Tooltip content="Mark As Complete">
                      <button
                        type="button"
                        aria-label="Mark As Complete"
                        onClick={() => actions.onCompleteFollowUp(nextFollowUp)}
                        className="focus-ring flex size-6 items-center justify-center rounded-full text-ink-subtle transition-colors duration-(--duration-shell) ease-shell hover:text-brand-strong"
                      >
                        <IconCircleCheck
                          size={20}
                          stroke={1.75}
                          aria-hidden="true"
                        />
                      </button>
                    </Tooltip>
                  </div>
                  {nextFollowUp.description && (
                    <p className="mt-1 text-sm break-words whitespace-pre-wrap text-ink-muted">
                      {nextFollowUp.description}
                    </p>
                  )}
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <span className="inline-flex items-center gap-1 text-sm font-medium text-brand-strong">
                      <IconLayoutGrid
                        size={16}
                        stroke={1.75}
                        className="text-brand"
                        aria-hidden="true"
                      />
                      {TYPE_LABEL[nextFollowUp.type]}
                    </span>
                    <Button
                      size="sm"
                      onClick={() => actions.onNewFollowUp(lead)}
                    >
                      <IconPlus size={16} stroke={2} aria-hidden="true" />
                      New Follow-up
                    </Button>
                  </div>
                </dd>
              </>
            ) : (
              <>
                <dt className="text-sm font-medium text-ink">Add Follow-up</dt>
                <dd>
                  <p className="text-sm text-ink-muted">
                    No follow-ups created yet. Add one to schedule the next
                    action and stay on track.
                  </p>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => actions.onNewFollowUp(lead)}
                  >
                    <IconPlus size={16} stroke={2} aria-hidden="true" />
                    New Follow-up
                  </Button>
                </dd>
              </>
            )}

            <dt className="text-sm font-medium text-ink">Recent Notes</dt>
            <dd>
              {latestNote ? (
                <p className="text-sm break-words whitespace-pre-wrap text-ink">
                  {latestNote.body}
                </p>
              ) : (
                <p className="text-sm text-ink-muted">
                  No notes added yet. Add one to record important details and
                  updates.
                </p>
              )}
              <Button
                size="sm"
                className="mt-3"
                onClick={() => actions.onAddNote(lead)}
              >
                <IconPlus size={16} stroke={2} aria-hidden="true" />
                Add Note
              </Button>
            </dd>
          </dl>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5 scrollbar-slim">
          <h3 className="mb-4 text-sm font-semibold text-ink">Timeline</h3>
          {failure ? (
            <ErrorState
              title="Couldn’t load activity"
              description="Something went wrong while loading this lead’s timeline."
              onRetry={() => setRetry((token) => token + 1)}
            />
          ) : timeline === null ? (
            <div className="flex min-h-24 items-center justify-center text-ink-muted">
              <IconLoader2
                size={20}
                className="animate-spin"
                aria-label="Loading"
              />
            </div>
          ) : timeline.length === 0 ? (
            <p className="text-sm text-ink-muted">No activity yet.</p>
          ) : (
            <LeadTimeline events={timeline} />
          )}
        </div>
      </div>
    </Drawer>
  );
}
