import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { KpiSlotAccent } from "./dashboard-kpi-cards";

/**
 * One card of the Workpex Dashboard KPI carousel.
 *
 * Every dimension is measured on ui-reference/dashboard/dashboard-home-default-top.png
 * at its native 1920 capture — card 315×129, 24px side padding, 34px icon badge, 14px
 * radius, 16/29/13px type, 1px border at full accent strength — and carried here at the
 * product's density, ×0.9 (ADR-0076): 284×116, 22px padding, 30px badge, 12px radius
 * (`rounded-surface`), 14/26/12px type.
 *
 * Deliberately not a `StatCard`. That card draws a 40 %-opacity border on a flat tint
 * and gives its caption a full row; this one needs a full-strength border, the glow
 * (`kpi-glow`) and a description truncated to a single line the way the reference
 * truncates its own ("Total number of targets assigned to the .."). Keeping it separate
 * leaves the GPS, Call Dashboard and configured-summary rows that use `StatCard`
 * untouched.
 *
 * The gap and the uneven padding are arithmetic, not taste. Content sums to 108px, so
 * `min-h-29` sets the card at the reference's 116px and `mt-auto` hands the 8px of
 * slack to the description — which is what puts each element where the reference has
 * it: title cap 20px from the top (reference 19.8), value cap 54 (55), description ink
 * 94-102 (94.5-102.6). A symmetric padding put the description 6px too high.
 *
 * `children` is the value slot rather than a string so the carousel can hand it a
 * number, the Unavailable marker or a skeleton without this card knowing which.
 */
export function DashboardKpiCard({
  title,
  description,
  icon: IconComponent,
  accent,
  children,
}: {
  title: string;
  description: string;
  icon: Icon;
  accent: KpiSlotAccent;
  children: React.ReactNode;
}) {
  return (
    <article
      className={cn(
        "kpi-glow flex min-h-29 w-71 flex-col gap-1.5 rounded-surface border px-5.5 pt-3.5 pb-2",
        accent.surface,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <h3 className="min-w-0 truncate text-sm text-ink">{title}</h3>
        <span
          className={cn(
            "flex size-7.5 shrink-0 items-center justify-center rounded-full text-white",
            accent.badge,
          )}
        >
          <IconComponent
            aria-hidden="true"
            stroke={1.75}
            className="size-1/2"
          />
        </span>
      </div>

      <div className="text-[26px] leading-none font-semibold text-ink">
        {children}
      </div>

      {/* mt-auto pins the description to the baseline; the reference truncates it to one
          line, and the full string stays reachable as the title attribute. */}
      <p
        className="mt-auto truncate text-xs text-ink-muted"
        title={description}
      >
        {description}
      </p>
    </article>
  );
}
