import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

/** Tinted body + tone border, per ui-reference/dashboard/dashboard-kpi-carousel-cards-5-9.png. */
const SURFACE_CLASS: Record<Tone, string> = {
  brand: "border-brand/40 bg-brand/10",
  neutral: "border-hairline bg-canvas",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  info: "border-info/40 bg-info/10",
};

/** The icon badge is the only saturated element on the card. */
const ICON_CLASS: Record<Tone, string> = {
  brand: "bg-brand",
  neutral: "bg-ink-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

type StatCardProps = {
  label: string;
  value: string;
  caption: string;
  tone: Tone;
  icon: Icon;
} & Omit<React.ComponentPropsWithoutRef<"div">, "children">;

export function StatCard({
  label,
  value,
  caption,
  tone,
  icon: IconComponent,
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-surface border p-4",
        SURFACE_CLASS[tone],
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <p className="text-sm text-ink">{label}</p>
        <span
          className={cn(
            "flex size-control-sm shrink-0 items-center justify-center rounded-full text-white",
            ICON_CLASS[tone],
          )}
        >
          <IconComponent
            aria-hidden="true"
            stroke={1.75}
            className="size-1/2"
          />
        </span>
      </div>
      <p className="text-3xl leading-none font-semibold text-ink">{value}</p>
      {/* mt-auto keeps the caption on the baseline when a row of cards stretches. */}
      <p className="mt-auto text-xs text-ink-muted">{caption}</p>
    </div>
  );
}
