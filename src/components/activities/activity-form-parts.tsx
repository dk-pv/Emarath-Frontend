"use client";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { ActivityType } from "@/services/activities-service";
import type {
  ActivityWorkflowSettings,
  FollowUpFieldKey,
} from "@/services/activity-settings-service";
import type { SelectOption } from "@/types";

/** Follow Up Type options and labels, shared by the edit and create follow-up forms. */
export const TYPE_OPTIONS: SelectOption[] = [
  { value: "CALL", label: "Call" },
  { value: "MEETING", label: "Meeting" },
  { value: "TASK", label: "Task" },
];

export const TYPE_LABEL: Record<ActivityType, string> = {
  CALL: "Call",
  MEETING: "Meeting",
  TASK: "Task",
};

/**
 * The follow-up form's field order before anything is configured — the same sequence the
 * drawers have always rendered, so an unreachable settings row changes nothing.
 * `LOCATION` is absent because no follow-up form renders a location picker yet: the
 * builder can select it, and the field appears here once ACT-03.2 grows the control.
 */
const SHIPPED_FIELD_ORDER: FollowUpFieldKey[] = [
  "DESCRIPTION",
  "ASSIGNED_TO",
  "LEAD_NAME",
  "DUE_DATE",
  "START_TIME",
  "END_TIME",
];

/** Every key a follow-up drawer can actually draw a control for today. */
const RENDERABLE: readonly FollowUpFieldKey[] = SHIPPED_FIELD_ORDER;

/**
 * The Follow Up Type dropdown's options (Settings → Activity and Reminders → Follow Up
 * Types), or the shipped three when nothing is configured.
 *
 * Only a type bound to a stored activity type is offered: a custom type is a name and a
 * field configuration, and `Activity.type` has no value to store it as, so offering it
 * would be offering a follow-up that cannot be created (ADR-0071).
 */
export function followUpTypeOptions(
  workflow: ActivityWorkflowSettings | null,
): SelectOption[] {
  const configured = (workflow?.followUpTypes ?? []).filter(
    (type) => type.activityType !== null,
  );
  return configured.length === 0
    ? TYPE_OPTIONS
    : configured.map((type) => ({
        value: type.activityType as string,
        label: type.name,
      }));
}

/**
 * The fields one type's follow-up form shows, in the configured order.
 *
 * Without a configuration this is the shipped order, with End Time on a Meeting or a
 * Task only — exactly what the drawers did before the builder existed.
 */
export function followUpFieldOrder(
  workflow: ActivityWorkflowSettings | null,
  type: ActivityType | null,
): FollowUpFieldKey[] {
  const configured = workflow?.followUpTypes.find(
    (candidate) => candidate.activityType === type,
  );

  if (!configured) {
    return SHIPPED_FIELD_ORDER.filter(
      (key) =>
        key !== "END_TIME" || type === "MEETING" || type === "TASK",
    );
  }

  return [...configured.fields]
    .sort((a, b) => a.position - b.position)
    .map((field) => field.key)
    .filter((key) => RENDERABLE.includes(key));
}

export const HOUR_OPTIONS: SelectOption[] = Array.from(
  { length: 12 },
  (_, i) => ({
    value: String(i + 1),
    label: String(i + 1),
  }),
);

export const MINUTE_OPTIONS: SelectOption[] = Array.from(
  { length: 12 },
  (_, i) => {
    const m = String(i * 5).padStart(2, "0");
    return { value: m, label: m };
  },
);

export const AMPM_OPTIONS: SelectOption[] = [
  { value: "AM", label: "AM" },
  { value: "PM", label: "PM" },
];

/** HH / MM / AM-PM selects for a due or end time (Workpex: three dropdowns). */
export function TimeRow({
  hour,
  minute,
  ampm,
  onHour,
  onMinute,
  onAmpm,
}: {
  hour: string | null;
  minute: string | null;
  ampm: string | null;
  onHour: (v: string | null) => void;
  onMinute: (v: string | null) => void;
  onAmpm: (v: string | null) => void;
}) {
  return (
    <div className="flex gap-2">
      <SearchableSelect
        searchable={false}
        options={HOUR_OPTIONS}
        value={hour}
        onChange={onHour}
        placeholder="HH"
      />
      <SearchableSelect
        searchable={false}
        options={MINUTE_OPTIONS}
        value={minute}
        onChange={onMinute}
        placeholder="MM"
      />
      <SearchableSelect
        searchable={false}
        options={AMPM_OPTIONS}
        value={ampm}
        onChange={onAmpm}
        placeholder="AM/PM"
      />
    </div>
  );
}

export type TimeParts = { hour: string; minute: string; ampm: string };

/** ISO instant → 12-hour parts, minutes snapped to the 5-minute options. */
export function splitTime(iso: string): TimeParts {
  const d = new Date(iso);
  const ampm = d.getHours() < 12 ? "AM" : "PM";
  const h12 = d.getHours() % 12 || 12;
  const minute = String(
    Math.min(55, Math.round(d.getMinutes() / 5) * 5),
  ).padStart(2, "0");
  return { hour: String(h12), minute, ampm };
}

/** A due date + 12-hour parts → an ISO instant in the client's timezone. */
export function composeIso(
  date: Date,
  hour: string,
  minute: string,
  ampm: string,
): string {
  const h = (Number(hour) % 12) + (ampm === "PM" ? 12 : 0);
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    h,
    Number(minute),
    0,
    0,
  ).toISOString();
}
