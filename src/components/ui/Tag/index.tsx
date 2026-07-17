import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

/**
 * Tone reads from the fill and border, never from the text: at 10% tint none of
 * the palette hues clear 4.5:1 as a foreground, so the label stays ink.
 */
const TONE_CLASS: Record<Tone, string> = {
  brand: "border-brand/40 bg-brand/10",
  neutral: "border-hairline bg-canvas",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  info: "border-info/40 bg-info/10",
};

const BASE_CLASS =
  "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium text-ink";

type TagProps = {
  tone?: Tone;
} & React.ComponentPropsWithoutRef<"span">;

export function Tag({
  tone = "neutral",
  className,
  children,
  ...props
}: TagProps) {
  return (
    <span className={cn(BASE_CLASS, TONE_CLASS[tone], className)} {...props}>
      <span className="truncate">{children}</span>
    </span>
  );
}
