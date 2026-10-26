import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";

/**
 * The Analytics reports' KPI accents: a full-strength border and badge over a tint with the
 * dashboard's white glow — the same card family as `DashboardKpiCard`, at these reports' own
 * size. Whole class strings so Tailwind emits them.
 */
export const KPI_ACCENTS = {
  blue: { surface: "border-kpi-blue bg-kpi-blue/10", badge: "bg-kpi-blue" },
  green: { surface: "border-kpi-green bg-kpi-green/12", badge: "bg-kpi-green" },
  amber: { surface: "border-warning bg-warning/14", badge: "bg-warning" },
  red: { surface: "border-danger bg-danger/10", badge: "bg-danger" },
  purple: {
    surface: "border-kpi-purple bg-kpi-purple/10",
    badge: "bg-kpi-purple",
  },
} as const;

export type KpiAccent = keyof typeof KPI_ACCENTS;

/**
 * One KPI card (Oct 2026 captures, 311×115 at this density): title and round icon badge, the
 * figure, and a one-line caption pinned to the bottom. `value` is a node so a card can show the
 * two-figure layout (Pipeline Value | Lead Count) or a skeleton.
 */
export function SalesKpiCard({
  title,
  icon: Glyph,
  accent,
  caption,
  children,
}: {
  title: string;
  icon: Icon;
  accent: KpiAccent;
  caption: string;
  children: React.ReactNode;
}) {
  const tone = KPI_ACCENTS[accent];
  return (
    <article
      className={cn(
        "kpi-glow flex min-h-[115px] min-w-0 flex-col rounded-[14px] border px-4 pt-[9px] pb-2.5",
        tone.surface,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-xs text-ink">{title}</h3>
        <span
          className={cn(
            "flex size-7.5 shrink-0 items-center justify-center rounded-full text-white",
            tone.badge,
          )}
        >
          <Glyph size={16} stroke={1.75} aria-hidden="true" />
        </span>
      </div>
      {children}
      <p
        className="mt-auto truncate pt-1 text-[10px] leading-3.5 text-ink-soft"
        title={caption}
      >
        {caption}
      </p>
    </article>
  );
}

/** A KPI card's single figure. */
export function KpiValue({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-[18px] truncate text-[16.5px] leading-6 font-semibold text-ink">
      {children}
    </div>
  );
}

/** Two figures with their labels, split by a rule — Total Open Leads, Closing This Month. */
export function KpiPair({
  first,
  second,
}: {
  first: { value: React.ReactNode; label: string };
  second: { value: React.ReactNode; label: string };
}) {
  return (
    <div className="flex min-w-0 items-stretch gap-2.5">
      {[first, second].map((part, index) => (
        <div
          key={part.label}
          className={cn(
            "flex min-w-0 flex-col",
            index === 1 && "border-l border-ink-soft/40 pl-2.5",
          )}
        >
          <div className="mb-1 truncate text-[15px] leading-5 font-semibold text-ink">
            {part.value}
          </div>
          <span className="truncate text-[10px] leading-3.5 text-ink-soft">
            {part.label}
          </span>
        </div>
      ))}
    </div>
  );
}

/** A bordered report panel: title, one-line subtitle, a rule, then its content. */
export function SalesPanel({
  title,
  subtitle,
  className,
  children,
}: {
  title: React.ReactNode;
  subtitle: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "flex min-w-0 flex-col rounded-[18px] border border-hairline bg-surface",
        className,
      )}
    >
      <header className="border-b border-hairline px-4 pt-[13px] pb-[11px]">
        <h3 className="text-[15px] leading-5 font-medium text-ink">{title}</h3>
        <p className="mt-0.5 text-sm text-ink-soft">{subtitle}</p>
      </header>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </section>
  );
}

/**
 * The reports' panel empty state: a line drawing, a title and two lines of help. The Workpex
 * drawings are its own artwork, so the Tabler line icon nearest each stands in.
 */
export function SalesPanelEmpty({
  icon: Glyph,
  title = "No result with current filter",
  description = "There’s no data for the selected date range or filters. Try adjusting your filters to see more results.",
}: {
  icon: Icon;
  title?: string;
  description?: string;
}) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-12 text-center">
      <Glyph size={64} stroke={1.1} className="text-ink" aria-hidden="true" />
      <p className="mt-2 text-[15px] font-medium text-ink">{title}</p>
      <p className="max-w-sm text-sm leading-6 text-ink-soft">{description}</p>
    </div>
  );
}
