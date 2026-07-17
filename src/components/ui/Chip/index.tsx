"use client";

import { IconX, type Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

const TONE_CLASS: Record<Tone, string> = {
  brand: "border-brand/40 bg-brand/10",
  neutral: "border-hairline bg-canvas",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  info: "border-info/40 bg-info/10",
};

const BASE_CLASS =
  "inline-flex h-control-sm max-w-full items-center gap-1.5 rounded-control border px-field-x text-sm text-ink";

const REMOVE_CLASS =
  "-mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded-full text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink focus-ring";

type ChipProps = {
  tone?: Tone;
  icon?: Icon;
  onRemove?: () => void;
  /** Names the remove control when the chip label alone is not descriptive enough. */
  removeLabel?: string;
} & React.ComponentPropsWithoutRef<"span">;

export function Chip({
  tone = "neutral",
  icon: IconComponent,
  onRemove,
  removeLabel = "Remove",
  className,
  children,
  ...props
}: ChipProps) {
  return (
    <span className={cn(BASE_CLASS, TONE_CLASS[tone], className)} {...props}>
      {IconComponent && (
        <IconComponent
          aria-hidden="true"
          stroke={1.75}
          className="size-4 shrink-0 text-ink-muted"
        />
      )}
      <span className="truncate">{children}</span>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          aria-label={removeLabel}
          className={REMOVE_CLASS}
        >
          <IconX aria-hidden="true" stroke={2} className="size-3.5" />
        </button>
      )}
    </span>
  );
}
