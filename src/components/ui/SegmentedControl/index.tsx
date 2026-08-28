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
  /** `brand` fills the active segment green (view toggles); `subtle` lifts it on canvas (map base layer). */
  variant?: "brand" | "subtle";
  /** Icon-only segments: the label becomes the tooltip and the screen-reader name. */
  iconOnly?: boolean;
  className?: string;
};

const ACTIVE_CLASS = {
  brand: "bg-brand text-white",
  subtle: "bg-canvas font-medium text-ink shadow-sm",
} as const;

/** A single-choice toggle of two or three segments in one bordered control (Workpex's view switchers). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
  variant = "brand",
  iconOnly = false,
  className,
  "aria-label": ariaLabel,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-0.5 rounded-control border border-hairline bg-surface p-0.5",
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
              "focus-ring flex h-control-sm items-center justify-center gap-1.5 rounded-[calc(var(--radius-control)-2px)] transition-colors duration-(--duration-shell) ease-shell",
              iconOnly ? "w-control-sm" : "px-3 text-sm",
              active
                ? ACTIVE_CLASS[variant]
                : "text-ink-muted hover:bg-canvas hover:text-ink",
            )}
          >
            {Glyph && <Glyph size={18} stroke={1.75} aria-hidden="true" />}
            {iconOnly ? <span className="sr-only">{label}</span> : label}
          </button>
        );
      })}
    </div>
  );
}
