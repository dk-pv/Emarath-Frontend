import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

/** danger is the navbar notification badge — --color-badge, not --color-danger. */
const TONE_CLASS: Record<Tone, string> = {
  brand: "bg-brand text-white",
  neutral: "bg-ink-muted text-white",
  success: "bg-success text-white",
  warning: "bg-warning text-white",
  danger: "bg-badge text-white",
  info: "bg-info text-white",
};

/** min-w rather than a fixed width so counts such as "99+" widen the pill. */
const BASE_CLASS =
  "inline-flex h-badge-dot min-w-badge-dot items-center justify-center rounded-full px-1 text-count font-medium";

type BadgeProps = {
  tone?: Tone;
} & React.ComponentPropsWithoutRef<"span">;

export function Badge({ tone = "neutral", className, ...props }: BadgeProps) {
  return (
    <span className={cn(BASE_CLASS, TONE_CLASS[tone], className)} {...props} />
  );
}
