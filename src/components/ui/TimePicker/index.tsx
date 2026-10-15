"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { IconClock } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { INPUT_BASE_CLASS, INPUT_SIZE_CLASS } from "@/components/ui/Input";
import { cn } from "@/lib/cn";
import {
  formatTime12,
  isTimeOfDay,
  timeFromParts,
  timeParts,
  type Meridiem,
  type TimeOfDay,
  type TimeParts,
} from "@/lib/date-time-range";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

export type TimePickerProps = {
  /** `HH:mm`, 24-hour — or null while no time is set. */
  value: TimeOfDay | null;
  onChange: (time: TimeOfDay | null) => void;
  /** Shown while unset; also names the control, so say what the time is for. */
  placeholder: string;
  disabled?: boolean;
  title?: string;
};

const HOURS = Array.from({ length: 12 }, (_, index) => index + 1);
const MINUTES = Array.from({ length: 60 }, (_, index) => index);
const MERIDIEMS: readonly Meridiem[] = ["AM", "PM"];

/** A first pick on a blank picker fills the other two with the start of the day: 12:00 AM. */
const BLANK: TimeParts = { hour: 12, minute: 0, meridiem: "AM" };

const PANEL_CLASS =
  "absolute top-[calc(100%+8px)] z-50 rounded-surface border border-hairline bg-surface p-3 shadow-lg";

/** The panel's rendered width — three columns, their gaps and the padding. */
const PANEL_WIDTH = 202;

const OPTION_CLASS =
  "focus-ring flex h-control-sm w-full shrink-0 items-center justify-center rounded-control text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas";

const OPTION_SELECTED_CLASS = "bg-brand font-medium hover:bg-brand-strong";

/**
 * One column of the picker: a listbox with a single tab stop (the chosen row, or the
 * first), moved with the arrow keys — which also choose, as a native select's do.
 */
function Column<T extends number | string>({
  label,
  items,
  selected,
  format,
  onPick,
}: {
  label: string;
  items: readonly T[];
  selected: T | null;
  format: (item: T) => string;
  onPick: (item: T) => void;
}) {
  const list = useRef<HTMLDivElement>(null);

  // Opening lands the chosen row mid-column; an unset column starts at the top.
  useEffect(() => {
    const row = list.current?.querySelector<HTMLElement>(
      '[aria-selected="true"]',
    );
    if (list.current && row) {
      list.current.scrollTop =
        row.offsetTop - (list.current.clientHeight - row.clientHeight) / 2;
    }
    // Only on open: later picks must not make the column jump under the pointer.
  }, []);

  const onKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    const step =
      event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
    if (step === 0) return;
    event.preventDefault();
    const current = selected === null ? -1 : items.indexOf(selected);
    const next = items[Math.min(items.length - 1, Math.max(0, current + step))];
    onPick(next);
    requestAnimationFrame(() =>
      list.current
        ?.querySelector<HTMLElement>('[aria-selected="true"]')
        ?.focus(),
    );
  };

  return (
    <div
      ref={list}
      role="listbox"
      aria-label={label}
      onKeyDown={onKeyDown}
      className="scrollbar-slim flex max-h-44 w-14 flex-col gap-0.5 overflow-y-auto"
    >
      {items.map((item, index) => {
        const active = item === selected;
        return (
          <button
            key={item}
            type="button"
            role="option"
            aria-selected={active}
            tabIndex={active || (selected === null && index === 0) ? 0 : -1}
            onClick={() => onPick(item)}
            className={cn(OPTION_CLASS, active && OPTION_SELECTED_CLASS)}
          >
            {format(item)}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A time of day on the app's 12-hour clock — a trigger that reads like the shared
 * `DatePicker`'s, opening hour / minute / AM-PM columns. Rendered by the app rather than
 * the browser's `<input type="time">`: that one follows the operating system's own
 * 12/24-hour setting (and ignores `lang`), so it would show 15:00 beside a product that
 * shows 3:00 PM everywhere.
 */
export function TimePicker({
  value,
  onChange,
  placeholder,
  disabled,
  title,
}: TimePickerProps) {
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const [alignEnd, setAlignEnd] = useState(false);

  /** Escape hands focus back to the trigger; an outside press must not steal it. */
  const dismiss = useCallback(() => {
    close();
    if (root.current?.contains(document.activeElement))
      trigger.current?.focus();
  }, [close]);

  useDismissable(root, isOpen, dismiss);

  const time = isTimeOfDay(value) ? value : null;
  const parts = time ? timeParts(time) : null;
  const pick = (patch: Partial<TimeParts>) =>
    onChange(timeFromParts({ ...(parts ?? BLANK), ...patch }));

  return (
    <div ref={root} className="relative min-w-0">
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        title={title}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={
          time ? `${placeholder}: ${formatTime12(time)}` : placeholder
        }
        onClick={() => {
          // A panel that would run off the right edge opens flush with the trigger's
          // right instead — decided on open, from where the trigger is now.
          if (!isOpen && trigger.current) {
            setAlignEnd(
              trigger.current.getBoundingClientRect().left + PANEL_WIDTH >
                window.innerWidth - 8,
            );
          }
          toggle();
        }}
        className={cn(
          INPUT_BASE_CLASS,
          INPUT_SIZE_CLASS.md,
          "flex items-center gap-2 text-left",
        )}
      >
        <IconClock
          aria-hidden="true"
          stroke={1.75}
          className="size-4 shrink-0 text-ink-muted"
        />
        <span className={cn("truncate", time === null && "text-ink-subtle")}>
          {time ? formatTime12(time) : placeholder}
        </span>
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-label={placeholder}
          className={cn(PANEL_CLASS, alignEnd ? "right-0" : "left-0")}
        >
          <div className="flex gap-1">
            <Column
              label="Hour"
              items={HOURS}
              selected={parts?.hour ?? null}
              format={String}
              onPick={(hour) => pick({ hour })}
            />
            <Column
              label="Minute"
              items={MINUTES}
              selected={parts?.minute ?? null}
              format={(minute) => String(minute).padStart(2, "0")}
              onPick={(minute) => pick({ minute })}
            />
            <Column
              label="AM or PM"
              items={MERIDIEMS}
              selected={parts?.meridiem ?? null}
              format={String}
              onPick={(meridiem) => pick({ meridiem })}
            />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3 border-t border-hairline pt-3">
            <button
              type="button"
              disabled={time === null}
              onClick={() => {
                onChange(null);
                dismiss();
              }}
              className="focus-ring rounded-control px-1 text-sm text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink disabled:cursor-not-allowed disabled:opacity-50"
            >
              Clear
            </button>
            <Button size="sm" onClick={dismiss}>
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
