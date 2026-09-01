"use client";

import { useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar } from "@/components/ui/DatePicker";
import { SearchableSelect } from "@/components/ui/SearchableSelect";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Tooltip } from "@/components/ui/Tooltip";
import {
  AMPM_OPTIONS,
  HOUR_OPTIONS,
  MINUTE_OPTIONS,
  composeIso,
  splitTime,
} from "@/components/activities/activity-form-parts";
import { cn } from "@/lib/cn";
import { useDismissable } from "@/hooks/use-dismissable";
import { formatDateTime } from "@/lib/format";
import type { ActivityListItem } from "@/services/activities-service";

const AMPM_SEGMENTS = AMPM_OPTIONS.map((option) => ({
  value: option.value as "AM" | "PM",
  label: option.label,
}));

/**
 * The panel is portalled and fixed-positioned: the worklist scrolls inside
 * `ResponsiveTableContainer` (`overflow-auto`), which would otherwise clip a popover
 * anchored to a row. Coordinates are captured when it opens — the panel is transient,
 * so it is not re-anchored on scroll, the same trade the portalled Tooltip makes.
 */
const PANEL_CLASS =
  "fixed z-[120] w-max rounded-surface border border-hairline bg-surface p-4 shadow-lg";

/** The date reads as an editable field while the panel is open, as Workpex shows it. */
const OPEN_TRIGGER_CLASS = "rounded-control border border-brand px-1.5 py-0.5";

type Draft = {
  date: Date;
  hour: string;
  minute: string;
  ampm: string;
};

function draftOf(iso: string): Draft {
  const at = new Date(iso);
  const { hour, minute, ampm } = splitTime(iso);
  return {
    date: new Date(at.getFullYear(), at.getMonth(), at.getDate()),
    hour,
    minute,
    ampm,
  };
}

/**
 * The Activities due date, editable in place (ACT-05.1's edit, on the row).
 *
 * Workpex turns the date into a field and drops a calendar plus a `Time HH : MM AM/PM`
 * row beneath it, rather than opening the Edit Follow-up drawer for a date change. The
 * calendar itself is the shared `DatePicker` grid — same component, different shell —
 * and the hour/minute options are the ones the follow-up forms already use.
 *
 * The edit is committed once, when the panel closes, so picking a day and then a time
 * is a single write rather than one per control. Read-only (no provider) it stays plain
 * text, keeping the list usable without row actions (ACT-02.2).
 */
export function ActivityDueDateEditor({
  row,
  overdue,
  onSave,
}: {
  row: ActivityListItem;
  overdue: boolean;
  onSave: (row: ActivityListItem, dueAt: string) => void;
}) {
  const root = useRef<HTMLSpanElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const labelId = useId();
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
    null,
  );
  const [draft, setDraft] = useState<Draft>(() => draftOf(row.dueAt));

  const text = formatDateTime(row.dueAt);
  const tone = overdue ? "text-rose-600" : "text-ink-muted";
  const isOpen = anchor !== null;

  const commit = () => {
    setAnchor(null);
    const next = composeIso(draft.date, draft.hour, draft.minute, draft.ampm);
    if (next !== new Date(row.dueAt).toISOString()) onSave(row, next);
  };

  // The panel is portalled, so it must count as "inside" or a press in it commits early.
  useDismissable([root, panelRef], isOpen, commit);

  const open = (event: React.MouseEvent<HTMLButtonElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    setDraft(draftOf(row.dueAt));
    setAnchor({ left: rect.left, top: rect.bottom + 8 });
  };

  const trigger = (
    <button
      type="button"
      onClick={open}
      aria-haspopup="dialog"
      aria-expanded={isOpen}
      className={cn(
        "focus-ring rounded-sm text-left text-xs transition-colors duration-(--duration-shell) ease-shell",
        tone,
        isOpen
          ? OPEN_TRIGGER_CLASS
          : "hover:underline hover:decoration-dotted hover:underline-offset-2",
      )}
    >
      {text}
    </button>
  );

  return (
    <span ref={root} className="flex">
      {isOpen ? (
        trigger
      ) : (
        <Tooltip content="click to change date" portal>
          {trigger}
        </Tooltip>
      )}

      {isOpen &&
        createPortal(
          <div
            ref={panelRef}
            role="dialog"
            aria-label="Change due date and time"
            className={PANEL_CLASS}
            style={{ left: anchor.left, top: anchor.top }}
          >
            <Calendar
              value={draft.date}
              labelId={labelId}
              onSelect={(date) => setDraft((prev) => ({ ...prev, date }))}
            />

            <div className="mt-3 flex items-center gap-2 border-t border-hairline pt-3">
              <span className="text-sm font-medium text-ink">Time</span>
              <span className="w-20">
                <SearchableSelect
                  searchable={false}
                  options={HOUR_OPTIONS}
                  value={draft.hour}
                  onChange={(hour) =>
                    setDraft((prev) => ({ ...prev, hour: hour ?? prev.hour }))
                  }
                  placeholder="HH"
                />
              </span>
              <span className="text-sm text-ink-muted">:</span>
              <span className="w-20">
                <SearchableSelect
                  searchable={false}
                  options={MINUTE_OPTIONS}
                  value={draft.minute}
                  onChange={(minute) =>
                    setDraft((prev) => ({
                      ...prev,
                      minute: minute ?? prev.minute,
                    }))
                  }
                  placeholder="MM"
                />
              </span>
              <SegmentedControl
                options={AMPM_SEGMENTS}
                value={draft.ampm as "AM" | "PM"}
                onChange={(ampm) => setDraft((prev) => ({ ...prev, ampm }))}
                aria-label="AM or PM"
              />
            </div>
          </div>,
          document.body,
        )}
    </span>
  );
}
