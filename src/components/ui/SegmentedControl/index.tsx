"use client";

import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

export type SegmentedOption<T extends string> = {
  value: T;
  label: string;
  icon?: Icon;
};

export type SegmentedControlProps<T extends string> = {
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  "aria-label": string;
  /** Icon-only segments: the label becomes the tooltip and the screen-reader name. */
  iconOnly?: boolean;
  /**
   * `pill`: the Analytics reports' round switcher (Full / Live Funnel View) — a grey track with
   * round 25px segments and 13.5px labels, measured from the Oct 2026 Sales Funnel capture.
   */
  variant?: "default" | "pill";
  className?: string;
};

const TRACK_CLASS = {
  default: "gap-0.5 rounded-control border-hairline bg-surface p-0.5",
  pill: "gap-0.5 rounded-full border-hairline bg-canvas p-1",
} as const;

const SEGMENT_CLASS = {
  default: "h-control-sm rounded-[calc(var(--radius-control)-2px)]",
  pill: "h-[25px] rounded-full",
} as const;

const LABEL_CLASS = {
  default: "px-3 text-sm",
  pill: "px-2 text-[13.5px] font-medium",
} as const;

const IDLE_CLASS = {
  default: "text-ink-muted hover:bg-canvas hover:text-ink",
  pill: "text-ink-soft hover:text-ink",
} as const;

/** A single-choice toggle of two or three segments in one bordered control (Workpex's view switchers). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  iconOnly = false,
  variant = "default",
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center border",
        TRACK_CLASS[variant],
        className,
      )}
    >
      {options.map(({ value: option, label, icon: Glyph }) => {
        const active = option === value;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={active}
            title={iconOnly ? label : undefined}
            onClick={() => onChange(option)}
            className={cn(
              "focus-ring flex items-center justify-center gap-1.5 transition-colors duration-(--duration-shell) ease-shell",
              SEGMENT_CLASS[variant],
              iconOnly ? "w-control-sm" : LABEL_CLASS[variant],
              active ? "bg-brand text-white" : IDLE_CLASS[variant],
            )}
          >
            {Glyph && <Glyph size={16} stroke={1.75} aria-hidden="true" />}
            {iconOnly ? <span className="sr-only">{label}</span> : label}
          </button>
        );
      })}
    </div>
  );
}
