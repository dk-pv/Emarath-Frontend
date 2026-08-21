"use client";

import { SearchableSelect } from "@/components/ui/SearchableSelect";
import type { ActivityType } from "@/services/activities-service";
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
