"use client";

import { IconClock, IconNote } from "@tabler/icons-react";
import { TYPE_LABEL } from "@/components/activities/activity-form-parts";
import type { LeadTimelineEvent } from "@/services/leads-service";

/**
 * The Lead Detail drawer's activity timeline (traced from the supplied Workpex
 * screenshots): newest first down a green rail of filled dots, each entry showing its
 * day ("Today", "06 Jul 2026") in bold, the time, a label with its subjects in bold,
 * and — for notes — the note body under a note icon. Rendered from the partial-but-honest feed
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

function EventLabel({ event }: { event: LeadTimelineEvent }) {
  if (event.type === "call") {
    return (
      <>
        <span className="font-semibold text-ink">
          {event.direction === "OUTBOUND" ? "Outbound" : "Inbound"} Call
        </span>{" "}
        by <span className="font-semibold text-ink">{event.agentName}</span>
      </>
    );
  }
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
  const today = new Date();

  return (
    <ol className="relative flex flex-col gap-5 border-l-2 border-brand/70 pl-6">
      {events.map((event) => {
        const at = new Date(event.at);
        return (
          <li
            key={event.id}
            className="relative border-b border-hairline pb-5 last:border-0 last:pb-0"
          >
            {/* Centred on the 2px rail, level with the date line. */}
            <span
              className="absolute top-[5px] -left-8 size-3.5 rounded-full bg-brand ring-4 ring-brand/30"
              aria-hidden="true"
            />
            <p className="text-base font-semibold text-ink">
              {dayLabel(at, today)}
            </p>
            <p className="mt-1.5 text-sm text-ink-muted">{timeLabel(at)}</p>
            <p className="mt-1 text-base text-ink-muted">
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
        );
      })}
    </ol>
  );
}
