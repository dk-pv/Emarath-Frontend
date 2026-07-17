"use client";

import {
  IconAlertCircle,
  IconAlertTriangle,
  IconCircleCheck,
  IconInfoCircle,
  IconX,
  type Icon,
} from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

const SURFACE_CLASS: Record<Tone, string> = {
  brand: "border-brand/40 bg-brand/10",
  neutral: "border-hairline bg-canvas",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  info: "border-info/40 bg-info/10",
};

const TONE_ICON: Record<Tone, Icon> = {
  brand: IconInfoCircle,
  neutral: IconInfoCircle,
  success: IconCircleCheck,
  warning: IconAlertTriangle,
  danger: IconAlertCircle,
  info: IconInfoCircle,
};

const TONE_ICON_CLASS: Record<Tone, string> = {
  brand: "text-brand",
  neutral: "text-ink-muted",
  success: "text-brand-strong",
  warning: "text-warning",
  danger: "text-danger",
  info: "text-info",
};

const DISMISS_CLASS =
  "-mt-1 -mr-1 inline-flex size-control-sm shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:text-ink focus-ring";

type AlertProps = {
  tone?: Tone;
  title: string;
  onDismiss?: () => void;
} & Omit<React.ComponentPropsWithoutRef<"div">, "title">;

export function Alert({
  tone = "info",
  title,
  onDismiss,
  className,
  children,
  ...props
}: AlertProps) {
  const IconComponent = TONE_ICON[tone];

  return (
    <div
      // Only the failure tones interrupt; the rest are announced politely.
      role={tone === "danger" || tone === "warning" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-3 rounded-surface border p-4",
        SURFACE_CLASS[tone],
        className,
      )}
      {...props}
    >
      <IconComponent
        aria-hidden="true"
        stroke={1.75}
        className={cn("mt-0.5 size-5 shrink-0", TONE_ICON_CLASS[tone])}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {children && (
          <div className="mt-1 text-sm text-ink-muted">{children}</div>
        )}
      </div>
      {onDismiss && (
        <button
          type="button"
          onClick={onDismiss}
          aria-label="Dismiss"
          className={DISMISS_CLASS}
        >
          <IconX aria-hidden="true" stroke={2} className="size-4" />
        </button>
      )}
    </div>
  );
}
