import { cn } from "@/lib/cn";

type MetricCardsRowProps = {
  children: React.ReactNode;
  className?: string;
  /**
   * Hides the scrollbar while keeping the row scrollable — Workpex draws no track
   * under its KPI carousel. Opt-in so the rows that still show the slim track are
   * untouched; the reserved track padding goes with it, so nothing shifts.
   */
  hideScrollbar?: boolean;
};

/**
 * The Workpex KPI carousel scrolls sideways rather than wrapping.
 *
 * Snap targets and shrink are applied to the children from here, so a metric card never
 * needs to know it lives in a carousel. By default the row shows a slim scrollbar with
 * `pb-2` reserving its track so it cannot sit on top of the cards; `hideScrollbar` drops
 * both for the Workpex Call Dashboard carousel, which shows no track at all.
 */
export function MetricCardsRow({
  children,
  className,
  hideScrollbar = false,
}: MetricCardsRowProps) {
  return (
    <div
      className={cn(
        "flex w-full min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto [&>*]:shrink-0 [&>*]:snap-start",
        // `pb-2` only reserves the slim track; with the scrollbar hidden there is
        // no track to reserve, so the row keeps its natural height.
        hideScrollbar ? "scrollbar-none" : "scrollbar-slim pb-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
