import { cn } from "@/lib/cn";

/**
 * The soft blob across the lower third of each stat card.
 *
 * **Decorative — deliberately not a chart.** Nothing in the reference labels it, no
 * axis or point is drawn, and it does not move with the figure above it. Rendering
 * it as a trend line would be inventing data the API does not return, so it is one
 * fixed path, hidden from assistive tech.
 */
export function StatWave({ className }: { className: string }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 320 90"
      preserveAspectRatio="none"
      className={cn(
        // w-full is load-bearing: an <svg> is a replaced element, so left:0/right:0
        // alone leaves it at its intrinsic 300px and the wave stops mid-card.
        "pointer-events-none absolute inset-x-0 bottom-0 h-[45%] w-full",
        className,
      )}
    >
      <path d="M0 46c34 0 46-30 82-30s52 38 88 38 54-30 90-30 42 14 60 18v48H0Z" />
    </svg>
  );
}

export type DashboardStatCardTone =
  "blue" | "green" | "peach" | "purple" | "pink";

/**
 * Two surfaces per tone: the saturated wash the selected bucket takes, and the pale
 * tint every other bucket keeps. See the `--color-stat-*` block in globals.css for
 * which of these are sampled and which are derived.
 */
const TONE_CLASS: Record<
  DashboardStatCardTone,
  { on: string; onWave: string; off: string; offWave: string }
> = {
  blue: {
    on: "bg-linear-to-br from-stat-blue-from to-stat-blue-to",
    onWave: "fill-stat-blue-wave",
    off: "bg-stat-blue-tint",
    offWave: "fill-stat-blue-tint-wave",
  },
  green: {
    on: "bg-linear-to-br from-stat-green-from to-stat-green-to",
    onWave: "fill-stat-green-wave",
    off: "bg-stat-green-tint",
    offWave: "fill-stat-green-tint-wave",
  },
  peach: {
    on: "bg-linear-to-br from-stat-peach-from to-stat-peach-to",
    onWave: "fill-stat-peach-wave",
    off: "bg-stat-peach-tint",
    offWave: "fill-stat-peach-tint-wave",
  },
  purple: {
    on: "bg-linear-to-br from-stat-purple-from to-stat-purple-to",
    onWave: "fill-stat-purple-wave",
    off: "bg-stat-purple-tint",
    offWave: "fill-stat-purple-tint-wave",
  },
  pink: {
    on: "bg-linear-to-br from-stat-pink-from to-stat-pink-to",
    onWave: "fill-stat-pink-wave",
    off: "bg-stat-pink-tint",
    offWave: "fill-stat-pink-tint-wave",
  },
};

/**
 * Which edge the caret leaves from. `down` is the Leads – Need Attention row, whose
 * table sits under the cards; `right` is the Activities rail, whose table sits beside
 * them. Both are measured from the reference — see the caret comment below.
 */
export type DashboardStatCardPointer = "down" | "right" | "none";

const POINTER_CLASS: Record<"down" | "right", string> = {
  down: "top-full left-1/2 -translate-x-1/2",
  right: "top-1/2 left-full -translate-y-1/2 -rotate-90",
};

/**
 * The selected card is joined to its table by a caret that straddles the 25px gutter
 * between them: apex against the card, legs opening onto the table's border. It is
 * drawn in the table's own chrome — canvas fill, hairline stroke — because in the
 * reference it *is* that border, bent toward the card. 28x26 and 26x25 at 1:1 in the
 * two captures; 25x23 at the chosen density (ADR-0076).
 *
 * A widget whose table header is not `bg-canvas` must say so: the fill has to match
 * the strip the caret opens into or the join shows.
 */
function StatCardPointer({ pointer }: { pointer: "down" | "right" }) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 26 24"
      className={cn(
        "pointer-events-none absolute h-[23px] w-[25px] fill-canvas stroke-hairline",
        POINTER_CLASS[pointer],
      )}
    >
      <path d="M1 24 13 1l12 23" />
    </svg>
  );
}

type DashboardStatCardProps = {
  title: string;
  /** Already formatted — the card never rounds, groups or clamps a figure itself. */
  value: string;
  tone: DashboardStatCardTone;
  active: boolean;
  /** Omit for a card that only reports: it then renders as a region, not a button. */
  onClick?: () => void;
  pointer?: DashboardStatCardPointer;
  className?: string;
};

/**
 * One bucket of a Dashboard drill-down widget — Leads – Need Attention
 * (dashboard-avatar-user-menu-open.png) and the Activities tracker
 * (dashboard-quick-add-plus-menu-open.png). Selecting a card filters the table it
 * points at; exactly one card is selected at a time.
 *
 * Both captures measure the card at 358x135 / 287x135 at 1:1 — the same 135 height,
 * the width being whatever the widget's rail or row gives it — so only the height is
 * fixed here. Selecting a card swaps its fill and ink and grows its wave; nothing
 * that occupies space changes, so the row cannot reflow as the user clicks along it.
 */
export function DashboardStatCard({
  title,
  value,
  tone,
  active,
  onClick,
  pointer = "down",
  className,
}: DashboardStatCardProps) {
  const toneClass = TONE_CLASS[tone];
  const shell = cn(
    "relative flex min-h-30.5 flex-col rounded-surface px-5.5 pt-7 pb-6 text-left",
    active ? toneClass.on : toneClass.off,
    className,
  );

  const body = (
    <>
      {/* The wave has to be clipped to the card's corners, but the caret must hang
          past them, so only the wave gets an overflow-hidden layer. The selected
          card draws the same wave ~1.4x larger, left-anchored — measured off the
          Overdue and No Activity cards against their unselected neighbours. */}
      <span className="absolute inset-0 overflow-hidden rounded-surface">
        <StatWave
          className={cn(
            active ? "h-[92%] w-[140%]" : "h-[64%]",
            active ? toneClass.onWave : toneClass.offWave,
          )}
        />
      </span>
      <span
        className={cn(
          "relative text-base font-medium",
          active ? "text-white" : "text-ink-soft",
        )}
      >
        {title}
      </span>
      <span
        className={cn(
          "relative mt-4.5 text-[22px] leading-none font-semibold",
          active ? "text-white" : "text-ink",
        )}
      >
        {value}
      </span>
      {active && pointer !== "none" && <StatCardPointer pointer={pointer} />}
    </>
  );

  if (!onClick) {
    return <section className={shell}>{body}</section>;
  }

  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(shell, "focus-ring")}
    >
      {body}
    </button>
  );
}
