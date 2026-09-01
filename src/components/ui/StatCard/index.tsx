import type { Icon } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

/**
 * Card accents. Wider than the app-wide `Tone` because the GPS Map KPI cards use two
 * colours the semantic set has no member for — sampled from
 * ui-reference/gps-map/GPS-MAP-overview.mp4. Kept local to StatCard rather than added
 * to `Tone`: they carry no status meaning, and widening `Tone` would force every
 * Alert/Badge/Chip/Tag/ConfirmDialog map to grow a branch none of them can use.
 */
export type StatCardTone = Tone | "pink" | "violet";

/** Tinted body + tone border, per ui-reference/dashboard/dashboard-kpi-carousel-cards-5-9.png. */
const SURFACE_CLASS: Record<StatCardTone, string> = {
  brand: "border-brand/40 bg-brand/10",
  neutral: "border-hairline bg-canvas",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  info: "border-info/40 bg-info/10",
  pink: "border-accent-pink/40 bg-accent-pink/10",
  violet: "border-accent-violet/40 bg-accent-violet/10",
};

/** The icon badge is the only saturated element on the card. */
const ICON_CLASS: Record<StatCardTone, string> = {
  brand: "bg-brand",
  neutral: "bg-ink-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
  pink: "bg-accent-pink",
  violet: "bg-accent-violet",
};

/**
 * `kpi` is the Workpex Call Dashboard carousel treatment: a wider, roomier card
 * with a bigger value and a smaller icon badge, and no caption row. Measured
 * against the reference — its cards are ~370×144 where the default is ~260×136,
 * and it is that extra width, not the badge, that makes the badge read as small.
 * `default` is every other stat card in the product and is unchanged.
 *
 * `field` is the GPS Map treatment. It began at the reference's measured 374×162, but
 * the GPS screen is a single viewport-height workspace and the map is its point — so the
 * card was tightened to 132px tall to hand that height back to the map. Everything that
 * carries meaning is unchanged (colour, icon, label, value, caption, hierarchy); only the
 * padding, gaps and type steps came down. It keeps the caption row (unlike `kpi`) because
 * the GPS cards all carry one, and truncates its label as the reference's
 * "Follow-up Complet.." does.
 */
export type StatCardVariant = "default" | "kpi" | "field";

const SHELL_CLASS: Record<StatCardVariant, string> = {
  default: "gap-2 p-4",
  kpi: "gap-4 px-5 py-5",
  field: "min-h-[8.25rem] gap-2 p-4",
};

const VALUE_CLASS: Record<StatCardVariant, string> = {
  default: "text-3xl leading-none",
  kpi: "text-[34px] leading-none",
  field: "text-[32px] leading-none",
};

const BADGE_CLASS: Record<StatCardVariant, string> = {
  default: "size-control-sm",
  kpi: "size-7",
  field: "size-9",
};

const LABEL_CLASS: Record<StatCardVariant, string> = {
  default: "text-sm",
  kpi: "text-sm",
  field: "min-w-0 truncate text-[15px]",
};

type StatCardProps = {
  /** A node, not just text, so a card can carry its own ⓘ tooltip beside the label. */
  label: React.ReactNode;
  value: string;
  /**
   * Optional: the Workpex KPI cards carry no sub-line at all, so a card given no
   * caption renders none rather than an empty row holding the height open.
   */
  caption?: React.ReactNode;
  /** Small suffix after the value, e.g. "Min" / "%" — the Workpex KPI unit. */
  unit?: string;
  tone: StatCardTone;
  icon: Icon;
  variant?: StatCardVariant;
} & Omit<React.ComponentPropsWithoutRef<"div">, "children">;

export function StatCard({
  label,
  value,
  caption,
  unit,
  tone,
  icon: IconComponent,
  variant = "default",
  className,
  ...props
}: StatCardProps) {
  return (
    <div
      className={cn(
        "flex flex-col rounded-surface border",
        SHELL_CLASS[variant],
        SURFACE_CLASS[tone],
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-3">
        <div className={cn("text-ink", LABEL_CLASS[variant])}>{label}</div>
        <span
          className={cn(
            "flex shrink-0 items-center justify-center rounded-full text-white",
            BADGE_CLASS[variant],
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
      <p className={cn("font-semibold text-ink", VALUE_CLASS[variant])}>
        {value}
        {unit && (
          <span className="ml-1 text-base font-medium text-ink-muted">
            {unit}
          </span>
        )}
      </p>
      {/* mt-auto keeps the caption on the baseline when a row of cards stretches. */}
      {caption !== undefined && (
        <p className="mt-auto text-xs text-ink-muted">{caption}</p>
      )}
    </div>
  );
}
