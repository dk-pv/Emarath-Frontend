"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

export type DatePickerProps = {
  value: Date | null;
  onChange: (date: Date | null) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
  /** Show the trigger as DD/MM/YYYY — the New Lead drawer's format (LEAD-06.2). */
  numeric?: boolean;
};

/** Pinned locale: the server and the browser must format identically or hydration fails. */
const TRIGGER_FORMAT = new Intl.DateTimeFormat("en-AE", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

/** en-GB renders day/month/year as DD/MM/YYYY, matching Workpex's Booking Date. */
const NUMERIC_TRIGGER_FORMAT = new Intl.DateTimeFormat("en-GB", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const MONTH_FORMAT = new Intl.DateTimeFormat("en-AE", {
  month: "long",
  year: "numeric",
});

const DAY_FORMAT = new Intl.DateTimeFormat("en-AE", {
  weekday: "long",
  day: "numeric",
  month: "long",
  year: "numeric",
});

const WEEKDAY_SHORT_FORMAT = new Intl.DateTimeFormat("en-AE", {
  weekday: "short",
});

const WEEKDAY_LONG_FORMAT = new Intl.DateTimeFormat("en-AE", {
  weekday: "long",
});

/** 2024-01-01 was a Monday — the anchor for the Monday-first header row. */
const WEEKDAYS = Array.from({ length: 7 }, (_, index) => {
  const day = new Date(2024, 0, 1 + index);
  return {
    short: WEEKDAY_SHORT_FORMAT.format(day),
    long: WEEKDAY_LONG_FORMAT.format(day),
  };
});

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

/** Day 0 of the next month is the last day of this one. */
function daysInMonth(month: Date): number {
  return new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
}

/**
 * Calendar arithmetic, not millisecond arithmetic: the Date constructor normalises
 * out-of-range days and months, so overflow across month and year ends is handled.
 */
function addDays(date: Date, days: number): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + days);
}

function addMonths(month: Date, months: number): Date {
  return new Date(month.getFullYear(), month.getMonth() + months, 1);
}

/** Keeps a day inside a target month — 31 Jan stepped to February lands on the 28th/29th. */
function clampToMonth(date: Date, month: Date): Date {
  return new Date(
    month.getFullYear(),
    month.getMonth(),
    Math.min(date.getDate(), daysInMonth(month)),
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** JS weeks start Sunday; this grid starts Monday. */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7;
}

function monthWeeks(month: Date): (Date | null)[][] {
  const cells: (Date | null)[] = [
    ...Array.from({ length: mondayIndex(startOfMonth(month)) }, () => null),
    ...Array.from(
      { length: daysInMonth(month) },
      (_, index) => new Date(month.getFullYear(), month.getMonth(), index + 1),
    ),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const weeks: (Date | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

const TRIGGER_CLASS =
  "flex h-control-md w-full items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink transition-colors duration-(--duration-shell) ease-shell focus-ring disabled:cursor-not-allowed disabled:opacity-50";

const PANEL_CLASS =
  "absolute top-[calc(100%+8px)] left-0 z-50 rounded-surface border border-hairline bg-surface p-3 shadow-lg";

const NAV_CLASS =
  "flex size-control-sm shrink-0 items-center justify-center rounded-control border border-hairline bg-surface text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring";

const DAY_CLASS =
  "flex size-control-sm items-center justify-center rounded-control border border-transparent text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring";

/** Brand green is too light for white text — the selected day keeps ink for contrast. */
const DAY_SELECTED_CLASS =
  "border-brand bg-brand font-medium text-ink hover:bg-brand-strong";

const DAY_TODAY_CLASS = "border-brand";

type CalendarProps = {
  value: Date | null;
  labelId: string;
  onSelect: (date: Date) => void;
};

function Calendar({ value, labelId, onSelect }: CalendarProps) {
  const grid = useRef<HTMLTableElement>(null);
  const today = useMemo(() => startOfDay(new Date()), []);
  const [viewMonth, setViewMonth] = useState(() =>
    startOfMonth(value ?? today),
  );
  const [focusedDate, setFocusedDate] = useState(() =>
    value ? startOfDay(value) : today,
  );

  /** Opening lands focus on the active day, but the month buttons must keep their own. */
  const shouldFocus = useRef(true);

  useEffect(() => {
    if (!shouldFocus.current) return;
    grid.current
      ?.querySelector<HTMLButtonElement>('[data-focused="true"]')
      ?.focus();
  }, [focusedDate]);

  /** Keeps the roving cell rendered: the view always follows the focused day. */
  const focusDate = (next: Date) => {
    shouldFocus.current = true;
    setFocusedDate(next);
    setViewMonth(startOfMonth(next));
  };

  const goMonth = (delta: number) => {
    shouldFocus.current = false;
    const target = addMonths(viewMonth, delta);
    setViewMonth(target);
    setFocusedDate(clampToMonth(focusedDate, target));
  };

  const onKeyDown = (event: React.KeyboardEvent<HTMLTableElement>) => {
    const moves: Record<string, () => Date> = {
      ArrowLeft: () => addDays(focusedDate, -1),
      ArrowRight: () => addDays(focusedDate, 1),
      ArrowUp: () => addDays(focusedDate, -7),
      ArrowDown: () => addDays(focusedDate, 7),
      Home: () => addDays(focusedDate, -mondayIndex(focusedDate)),
      End: () => addDays(focusedDate, 6 - mondayIndex(focusedDate)),
      PageUp: () =>
        clampToMonth(focusedDate, addMonths(startOfMonth(focusedDate), -1)),
      PageDown: () =>
        clampToMonth(focusedDate, addMonths(startOfMonth(focusedDate), 1)),
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    focusDate(move());
  };

  return (
    <>
      <div className="flex items-center justify-between gap-2 pb-3">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => goMonth(-1)}
          className={NAV_CLASS}
        >
          <IconChevronLeft size={16} stroke={2} />
        </button>
        <p id={labelId} aria-live="polite" className="text-sm font-medium">
          {MONTH_FORMAT.format(viewMonth)}
        </p>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => goMonth(1)}
          className={NAV_CLASS}
        >
          <IconChevronRight size={16} stroke={2} />
        </button>
      </div>

      <table
        ref={grid}
        role="grid"
        aria-labelledby={labelId}
        onKeyDown={onKeyDown}
        className="border-separate border-spacing-0.5"
      >
        <thead>
          <tr>
            {WEEKDAYS.map((weekday) => (
              <th
                key={weekday.long}
                scope="col"
                abbr={weekday.long}
                className="size-control-sm text-xs font-medium text-ink-subtle"
              >
                {weekday.short}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {monthWeeks(viewMonth).map((week, weekIndex) => (
            <tr key={weekIndex}>
              {week.map((day, dayIndex) =>
                day === null ? (
                  <td key={`blank-${dayIndex}`} className="p-0" />
                ) : (
                  <td
                    key={day.getTime()}
                    aria-selected={value !== null && isSameDay(day, value)}
                    className="p-0"
                  >
                    <button
                      type="button"
                      tabIndex={isSameDay(day, focusedDate) ? 0 : -1}
                      data-focused={isSameDay(day, focusedDate) || undefined}
                      aria-label={DAY_FORMAT.format(day)}
                      aria-current={isSameDay(day, today) ? "date" : undefined}
                      onClick={() => onSelect(day)}
                      className={cn(
                        DAY_CLASS,
                        isSameDay(day, today) && DAY_TODAY_CLASS,
                        value !== null &&
                          isSameDay(day, value) &&
                          DAY_SELECTED_CLASS,
                      )}
                    >
                      {day.getDate()}
                    </button>
                  </td>
                ),
              )}
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder,
  disabled,
  className,
  numeric,
}: DatePickerProps) {
  const triggerFormat = numeric ? NUMERIC_TRIGGER_FORMAT : TRIGGER_FORMAT;
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const labelId = useId();
  const { isOpen, close, toggle } = useDisclosure();

  /** Escape hands focus back to the trigger; an outside click must not steal it. */
  const dismiss = useCallback(() => {
    close();
    if (root.current?.contains(document.activeElement))
      trigger.current?.focus();
  }, [close]);

  useDismissable(root, isOpen, dismiss);

  const select = (date: Date) => {
    onChange(date);
    close();
    trigger.current?.focus();
  };

  const hasVisibleLabel = value !== null || placeholder !== undefined;

  return (
    <div ref={root} className={cn("relative", className)}>
      <button
        ref={trigger}
        type="button"
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={isOpen}
        aria-label={hasVisibleLabel ? undefined : "Select date"}
        onClick={toggle}
        className={TRIGGER_CLASS}
      >
        <IconCalendar
          aria-hidden="true"
          stroke={1.75}
          className="size-4 shrink-0 text-ink-muted"
        />
        <span className={cn("truncate", value === null && "text-ink-subtle")}>
          {value === null ? placeholder : triggerFormat.format(value)}
        </span>
      </button>

      {isOpen && (
        <div role="dialog" aria-labelledby={labelId} className={PANEL_CLASS}>
          <Calendar value={value} labelId={labelId} onSelect={select} />
        </div>
      )}
    </div>
  );
}
