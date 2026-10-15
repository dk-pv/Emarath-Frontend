"use client";

import { DatePicker } from "@/components/ui/DatePicker";
import { TimePicker } from "@/components/ui/TimePicker";
import type { DateTimeBound } from "@/lib/date-time-range";

/**
 * What a blank time means for each kind of bound — the picker only reads "Start time",
 * so the meaning rides in the tooltip. These are the defaults `boundStart` / `boundEnd`
 * apply (lib/date-time-range).
 */
const EDGE = {
  start: {
    label: "Start time",
    hint: "Optional. Left blank, the range starts at 12:00 AM.",
  },
  end: {
    label: "End time",
    hint: "Optional. Left blank, the range includes the whole day.",
  },
} as const;

export type DateTimeFieldProps = {
  value: DateTimeBound;
  onChange: (next: DateTimeBound) => void;
  placeholder: string;
  /** Start edges default to the start of the day, end edges to its end. */
  edge: keyof typeof EDGE;
  /** Names the time picker when "Start time" / "End time" would mislead (a lone "On" date). */
  timeLabel?: string;
  /** A DATE column has no time of day: the calendar alone, as before. */
  dateOnly?: boolean;
};

/**
 * A day from the shared calendar with an optional time of day — the custom range control
 * every date filter shares. The time is the app's own 12-hour picker, so a range reads the
 * same on every machine and matches the times the rest of the product shows.
 *
 * Day and time sit side by side when this control is wide enough for both (a date needs
 * ~117px, a time ~104px) and stack when it is not — decided by the control's own width, not
 * the viewport's, because the same control lives in a 590px panel and a 234px column.
 *
 * A time with no day means nothing, so it stays disabled until a day is picked.
 */
export function DateTimeField({
  value,
  onChange,
  placeholder,
  edge,
  timeLabel,
  dateOnly = false,
}: DateTimeFieldProps) {
  return (
    <div className="@container min-w-0">
      <div className="flex flex-col gap-2 @min-[15rem]:flex-row">
        <div className="min-w-0 flex-1">
          <DatePicker
            numeric
            value={value.day}
            placeholder={placeholder}
            onChange={(day) => onChange({ day, time: day ? value.time : null })}
          />
        </div>
        {!dateOnly && (
          <div className="@min-[15rem]:w-28 @min-[15rem]:shrink-0">
            <TimePicker
              placeholder={timeLabel ?? EDGE[edge].label}
              title={EDGE[edge].hint}
              disabled={value.day === null}
              value={value.time}
              onChange={(time) => onChange({ day: value.day, time })}
            />
          </div>
        )}
      </div>
    </div>
  );
}
