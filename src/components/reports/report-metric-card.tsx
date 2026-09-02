import { IconInfoCircle, type Icon } from "@tabler/icons-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";

/** The tinted card palette the metric rows use, in the references' order. */
export const CARD_TONES = {
  blue: { card: "border-blue-200 bg-blue-50", badge: "bg-blue-500" },
  red: { card: "border-red-200 bg-red-50", badge: "bg-red-500" },
  amber: { card: "border-amber-200 bg-amber-50", badge: "bg-amber-500" },
  emerald: {
    card: "border-emerald-200 bg-emerald-50",
    badge: "bg-emerald-500",
  },
  violet: { card: "border-violet-200 bg-violet-50", badge: "bg-violet-500" },
  orange: { card: "border-orange-200 bg-orange-50", badge: "bg-orange-500" },
  yellow: { card: "border-yellow-200 bg-yellow-50", badge: "bg-yellow-400" },
} as const;

export type CardTone = keyof typeof CARD_TONES;

/**
 * One report metric card: title (with an optional hint), an icon badge, the value and a
 * supporting line — the anatomy the Lead Aging and Lead First Response references share.
 */
export function ReportMetricCard({
  title,
  hint,
  icon: Glyph,
  value,
  label,
  badgeShape = "square",
  tone,
}: {
  title: string;
  /** Explains what the metric counts; shown as an ⓘ beside the title when given. */
  hint?: string;
  icon: Icon;
  value: string;
  /** Omit where the reference shows the value alone (Duplicate Enquiries). */
  label?: React.ReactNode;
  /** The icon badge's shape; the duplicate cards draw it as a circle. */
  badgeShape?: "square" | "circle";
  tone: CardTone;
}) {
  const tones = CARD_TONES[tone];
  return (
    <div
      className={cn(
        // Trimmed vertically: the same padding sideways, tighter top and bottom.
        "flex min-w-52 flex-1 flex-col rounded-surface border px-4 py-2.5",
        tones.card,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span className="flex min-w-0 items-center gap-1.5 text-sm font-medium text-ink">
          <span className="truncate">{title}</span>
          {hint && (
            <Tooltip content={hint} portal>
              <span className="inline-flex shrink-0 text-ink-subtle">
                <IconInfoCircle size={14} stroke={1.75} aria-label={hint} />
              </span>
            </Tooltip>
          )}
        </span>
        <span
          aria-hidden="true"
          className={cn(
            "flex size-7 shrink-0 items-center justify-center text-white",
            badgeShape === "circle" ? "rounded-full" : "rounded-control",
            tones.badge,
          )}
        >
          <Glyph size={16} stroke={1.75} />
        </span>
      </div>
      <p className="mt-1.5 text-lg font-semibold text-ink">{value}</p>
      {label !== undefined && (
        <p className="mt-0.5 text-xs text-ink-muted">{label}</p>
      )}
    </div>
  );
}
