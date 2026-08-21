"use client";

import { IconClock, IconNote } from "@tabler/icons-react";
import { TYPE_LABEL } from "@/components/activities/activity-form-parts";
import type { LeadTimelineEvent } from "@/services/leads-service";

/**
 * The Lead Detail drawer's activity timeline (traced from the supplied Workpex
 * screenshots): events grouped by day ("Today", "19 Aug 2026") down a vertical
 * line of dots, each showing the time, a bold label, and — for notes — the note
 * body under a note icon. Rendered from the partial-but-honest feed
 * (`GET /leads/:id/timeline`): Lead Created, Lead Assigned, Note Added. Client-only
 * (the drawer is a client component), so the local "today" comparison is safe.
 */

const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;
}

function dayLabel(date: Date, today: Date): string {
  if (dayKey(date) === dayKey(today)) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (dayKey(date) === dayKey(yesterday)) return "Yesterday";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

function timeLabel(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

/** Workpex's scheduled-time format on a follow-up entry, e.g. "28-08-2026 04:00 AM". */
function scheduleLabel(iso: string): string {
  const date = new Date(iso);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}-${mm}-${yyyy} ${timeLabel(date)}`;
}

type DayGroup = { key: string; label: string; events: LeadTimelineEvent[] };

/** Events arrive newest-first; walk them into contiguous day buckets in that order. */
function groupByDay(events: LeadTimelineEvent[]): DayGroup[] {
  const today = new Date();
  const groups: DayGroup[] = [];
  for (const event of events) {
    const date = new Date(event.at);
    const key = dayKey(date);
    const current = groups[groups.length - 1];
    if (current && current.key === key) {
      current.events.push(event);
    } else {
      groups.push({ key, label: dayLabel(date, today), events: [event] });
    }
  }
  return groups;
}

function EventLabel({ event }: { event: LeadTimelineEvent }) {
  if (event.type === "note") {
    return (
      <>
        <span className="font-semibold text-ink">Note</span> Added by{" "}
        <span className="font-semibold text-ink">{event.authorName}</span>
      </>
    );
  }
  if (event.type === "assigned") {
    return (
      <>
        Lead <span className="font-semibold text-ink">Assigned</span> to{" "}
        <span className="font-semibold text-ink">{event.assigneeName}</span>
      </>
    );
  }
  if (event.type === "followup-created") {
    return (
      <>
        <span className="font-semibold text-ink">
          Follow Up {TYPE_LABEL[event.activityType]}
        </span>{" "}
        Created
      </>
    );
  }
  if (event.type === "followup-completed") {
    return (
      <>
        <span className="font-semibold text-ink">
          Follow Up {TYPE_LABEL[event.activityType]}
        </span>{" "}
        Completed
      </>
    );
  }
  return (
    <>
      Lead <span className="font-semibold text-ink">Created</span>
    </>
  );
}

export function LeadTimeline({ events }: { events: LeadTimelineEvent[] }) {
  const groups = groupByDay(events);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.key} className="flex flex-col gap-4">
          <h4 className="text-sm font-semibold text-ink">{group.label}</h4>
          <ol className="relative flex flex-col gap-5 border-l border-brand/60 pl-6">
            {group.events.map((event) => (
              <li key={event.id} className="relative">
                <span
                  className="absolute top-1 -left-[1.8125rem] size-2.5 rounded-full border-2 border-surface bg-brand"
                  aria-hidden="true"
                />
                <p className="text-xs text-ink-muted">
                  {timeLabel(new Date(event.at))}
                </p>
                <p className="mt-0.5 text-sm text-ink-muted">
                  <EventLabel event={event} />
                </p>
                {event.type === "note" && (
                  <p className="mt-1 flex items-start gap-1.5 text-sm text-ink">
                    <IconNote
                      size={16}
                      stroke={1.75}
                      className="mt-0.5 shrink-0 text-ink-subtle"
                      aria-hidden="true"
                    />
                    <span className="break-words whitespace-pre-wrap">
                      {event.body}
                    </span>
                  </p>
                )}
                {(event.type === "followup-created" ||
                  event.type === "followup-completed") && (
                  <>
                    <p className="mt-1 flex items-center gap-1.5 text-xs text-ink-muted">
                      <IconClock
                        size={14}
                        stroke={1.75}
                        className="shrink-0"
                        aria-hidden="true"
                      />
                      {scheduleLabel(event.dueAt)}
                    </p>
                    {event.description && (
                      <p className="mt-1 flex items-start gap-1.5 text-sm text-ink">
                        <IconNote
                          size={16}
                          stroke={1.75}
                          className="mt-0.5 shrink-0 text-ink-subtle"
                          aria-hidden="true"
                        />
                        <span className="break-words whitespace-pre-wrap">
                          {event.description}
                        </span>
                      </p>
                    )}
                  </>
                )}
              </li>
            ))}
          </ol>
        </div>
      ))}
    </div>
  );
}
