"use client";

import { useRef } from "react";
import {
  IconCheck,
  IconChevronDown,
  IconFilter,
  IconX,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import {
  DASHBOARD_PERIODS,
  periodLabel,
  type DashboardPeriodId,
} from "@/lib/dashboard-period";

/**
 * One widget's own date filter (DASH-01.2) — the control Workpex draws in a widget
 * header: a green pill showing the applied period with an ✕ to clear it, and a
 * caret that opens the preset list. `dashboard-home-default-top.png` shows it on
 * the KPI row reading "This Month"; `…alerts-empty-state.png` shows a second one
 * on the Alerts widget reading "Yesterday" **at the same moment** — which is the
 * proof that these are per-widget, not one page filter.
 *
 * This component is deliberately stateless about *which* period is applied: the
 * widget owns that, so two of these can never share a value.
 */
export function WidgetPeriodFilter({
  value,
  onChange,
  /** What clearing (✕) falls back to. A widget's own sensible default (AC5). */
  clearTo = "all",
  label = "period",
}: {
  value: DashboardPeriodId;
  onChange: (next: DashboardPeriodId) => void;
  clearTo?: DashboardPeriodId;
  /** Names this control for assistive tech, e.g. "Overdue Follow-ups period". */
  label?: string;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);
  const showClear = value !== clearTo;

  return (
    <div ref={root} className="relative shrink-0">
      <span className="inline-flex h-control-sm items-center rounded-control border border-brand/40 bg-brand/10 text-sm text-ink">
        <span className="inline-flex items-center gap-1.5 pr-1 pl-field-x">
          <IconFilter
            size={14}
            stroke={1.75}
            aria-hidden="true"
            className="shrink-0 text-ink-muted"
          />
          <span className="truncate">{periodLabel(value)}</span>
          {showClear && (
            <button
              type="button"
              onClick={() => onChange(clearTo)}
              aria-label={`Clear ${label}`}
              className="focus-ring inline-flex size-4 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
            >
              <IconX size={14} stroke={2} aria-hidden="true" />
            </button>
          )}
        </span>
        <button
          type="button"
          aria-haspopup="menu"
          aria-expanded={isOpen}
          aria-label={`Change ${label}`}
          onClick={toggle}
          className="focus-ring inline-flex h-full items-center rounded-r-control border-l border-brand/40 px-1.5 text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink"
        >
          <IconChevronDown size={16} stroke={2} aria-hidden="true" />
        </button>
      </span>

      {isOpen && (
        <div
          role="menu"
          aria-label={label}
          className="absolute top-[calc(100%+6px)] right-0 z-30 min-w-40 rounded-surface border border-hairline bg-surface p-1 shadow-lg"
        >
          {DASHBOARD_PERIODS.map((period) => (
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
