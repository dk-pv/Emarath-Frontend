import { cn } from "@/lib/cn";
import type { Tone } from "@/types";

/** The dot before a cell's label: the tone's solid colour, as the Pipeline column headers draw it. */
const DOT_CLASS: Record<Tone, string> = {
  brand: "bg-brand",
  neutral: "bg-ink-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

/** The faint wash of a cell whose count needs acting on. */
const HIGHLIGHT_CLASS: Record<Tone, string> = {
  brand: "bg-brand/5",
  neutral: "bg-canvas",
  success: "bg-success/5",
  warning: "bg-warning/5",
  danger: "bg-danger/5",
  info: "bg-info/5",
};

export type StatStripItem = {
  key: string;
  label: string;
  /** Already formatted: a count, or "—" where the count does not apply. */
  value: string;
  /** Secondary text after the value, cut to the cell's width; the whole of it is the hover text. */
  caption?: string;
  /** The dot before the label. Tint only — the label always carries the meaning. */
  tone?: Tone;
  /** Washes the cell in its tone: kept for a count someone must act on. */
  highlight?: boolean;
  /** Greys the value: a count outside the filter in force. */
  muted?: boolean;
  /** Given on a cell that is a filter: whether it is the one in force. */
  pressed?: boolean;
  /** Makes the cell a button. */
  onClick?: () => void;
  /** The button's name, when its text alone would not say what a press does. */
  ariaLabel?: string;
  /** Hover text, e.g. why a count reads "—". */
  title?: string;
};

/**
 * A row of counts in one hairline card, split into cells — the Logistics delivery buckets and order
 * statuses, the Accounts payment statuses. Those screens have no Workpex equivalent (CLAUDE.md §1A),
 * so it is built from the shared tokens: a dot in the status tone, a muted label, the count as the
 * largest text and an optional caption. A cell with `onClick` is a button, and a `pressed` one shows
 * the filter in force with a brand underline, as a tab would. Narrower than its cells, the row
 * scrolls sideways rather than squeezing them; `footer` sits under it, inside the card.
 */
export function StatStrip({
  label,
  items,
  footer,
  className,
}: {
  /** Names the group of cells for assistive tech. */
  label: string;
  items: readonly StatStripItem[];
  footer?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 overflow-hidden rounded-surface border border-hairline bg-surface",
        className,
      )}
    >
      <div
        role="group"
        aria-label={label}
        className="scrollbar-slim flex min-w-0 overflow-x-auto"
      >
        {items.map((item) => (
          <StatStripCell key={item.key} item={item} />
        ))}
      </div>
      {footer && <div className="border-t border-hairline">{footer}</div>}
    </div>
  );
}

function StatStripCell({ item }: { item: StatStripItem }) {
  const { label, value, caption, tone, highlight, muted, pressed, onClick } =
    item;
  const body = (
    <>
      <span className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-ink-muted">
        {tone && (
          <span
            aria-hidden="true"
            className={cn("size-2 shrink-0 rounded-full", DOT_CLASS[tone])}
          />
        )}
        <span className="truncate">{label}</span>
      </span>
      <span className="flex min-w-0 items-baseline gap-2">
        <span
          className={cn(
            "text-xl leading-none font-semibold tabular-nums",
            muted ? "text-ink-subtle" : "text-ink",
          )}
        >
          {value}
        </span>
        {caption && (
          <span className="truncate text-xs text-ink-muted">{caption}</span>
        )}
      </span>
    </>
  );
  const cell = cn(
    "relative flex min-w-36 flex-1 flex-col gap-1.5 border-l border-hairline px-3.5 py-2 text-left first:border-l-0",
    highlight && tone && HIGHLIGHT_CLASS[tone],
  );

  if (!onClick) {
    return (
      <div className={cell} title={item.title}>
        {body}
      </div>
    );
  }
  return (
    <button
      type="button"
      aria-pressed={pressed}
      aria-label={item.ariaLabel}
      title={item.title ?? caption}
      onClick={onClick}
      className={cn(
        cell,
        "focus-ring-inset transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas",
        pressed &&
          "bg-brand-subtle after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:bg-brand hover:bg-brand-subtle",
      )}
    >
      {body}
    </button>
  );
}
