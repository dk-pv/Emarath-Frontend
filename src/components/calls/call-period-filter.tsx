"use client";

import { useRef } from "react";
import { IconCheck, IconFilter } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

export type PeriodId = "today" | "yesterday" | "this-week" | "this-month";

/**
 * The period presets the summary Filter offers (CALL-03.2 AC3). Mirrors the
 * Workpex Summary Filters popup, minus the deferred "All", "Select User" and
 * custom Date From/To legs (the last two need API support that CALL-03.1 does
 * not yet provide).
 */
export const PERIODS: { id: PeriodId; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This Week" },
  { id: "this-month", label: "This Month" },
];

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * The user's local range for a preset; `to` is exclusive (end of today). Shared
 * by the summary cards and the leaderboard so both reflect the one Filter.
 */
export function rangeFor(period: PeriodId): { from: string; to: string } {
  const todayStart = startOfDay(new Date());
  const tomorrow = new Date(todayStart);
  tomorrow.setDate(tomorrow.getDate() + 1);

  let from = todayStart;
  let to = tomorrow;
  if (period === "yesterday") {
    from = new Date(todayStart);
    from.setDate(from.getDate() - 1);
    to = todayStart;
  } else if (period === "this-week") {
    from = new Date(todayStart);
    from.setDate(from.getDate() - ((from.getDay() + 6) % 7)); // Monday
  } else if (period === "this-month") {
    from = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  }
  return { from: from.toISOString(), to: to.toISOString() };
}

/**
 * The green "Filter" control from the video: a brand button that opens the
 * period presets and applies one on click. Own disclosure (not the shared
 * Popover) so a selection closes the menu — the shared Popover cannot close
 * from within.
 */
export function CallPeriodFilter({
  value,
  onChange,
}: {
  value: PeriodId;
  onChange: (period: PeriodId) => void;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        className="focus-ring inline-flex h-control-sm items-center gap-2 rounded-control bg-brand px-3 text-sm font-medium text-white transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-strong"
      >
        <IconFilter size={16} stroke={1.75} aria-hidden="true" />
        Filter
      </button>

      {isOpen && (
        <div
          role="menu"
          className="absolute top-[calc(100%+8px)] right-0 z-50 min-w-40 rounded-surface border border-hairline bg-surface p-1 shadow-lg"
        >
          {PERIODS.map((period) => (
            <button
              key={period.id}
              type="button"
              role="menuitemradio"
              aria-checked={period.id === value}
              onClick={() => {
                onChange(period.id);
                close();
              }}
              className={cn(
                "focus-ring flex w-full items-center justify-between gap-3 rounded-control px-3 py-2 text-left text-sm transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas",
                period.id === value ? "font-medium text-ink" : "text-ink-muted",
              )}
            >
              {period.label}
              {period.id === value && (
                <IconCheck
                  size={16}
                  stroke={2}
                  className="text-brand"
                  aria-hidden="true"
                />
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
