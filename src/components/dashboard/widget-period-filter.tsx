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
/**
 * Workpex draws this control at two sizes: the widget-header chip, and the larger one
 * on the Dashboard's own control row. Measured on dashboard-home-default-top.png the
 * page chip is 40px tall against the widget chip's ~31px — 36px at the product's
 * density (ADR-0076). Its type is 14px in both: "This Month" occupies 79px on the 1:1
 * reference, and Plus Jakarta Sans sets that string in 80px at 16px and 70px at 14px,
 * so 16 at 1:1 is 14 here. The page chip is a taller control, not larger text.
 */
const SIZE_CLASS = {
  sm: "h-control-sm border border-brand/40 bg-brand/10 text-sm",
  lg: "h-control-md bg-brand/30 text-sm",
} as const;

export function WidgetPeriodFilter({
  value,
  onChange,
  /** What clearing (✕) falls back to. A widget's own sensible default (AC5). */
  clearTo = "all",
  label = "period",
  size = "sm",
}: {
  value: DashboardPeriodId;
  onChange: (next: DashboardPeriodId) => void;
  clearTo?: DashboardPeriodId;
  /** Names this control for assistive tech, e.g. "Overdue Follow-ups period". */
  label?: string;
  size?: keyof typeof SIZE_CLASS;
}) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);
  const showClear = value !== clearTo;

  return (
    <div ref={root} className="relative shrink-0">
      <span
        className={cn(
          "inline-flex items-center rounded-control text-ink",
          SIZE_CLASS[size],
        )}
      >
        <span
          className={cn(
            "inline-flex items-center",
            size === "lg" ? "gap-2 pr-1.5 pl-3" : "gap-1.5 pr-1 pl-field-x",
          )}
        >
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
          className={cn(
            "focus-ring inline-flex h-full items-center rounded-r-control border-l text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink",
            // The page chip's divider is a white hairline on the solid fill; the widget
            // chip's is the same brand outline it is bordered with.
            size === "lg" ? "border-surface px-3" : "border-brand/40 px-1.5",
          )}
        >
          <IconChevronDown
            size={size === "lg" ? 14 : 16}
            stroke={2}
            aria-hidden="true"
          />
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
