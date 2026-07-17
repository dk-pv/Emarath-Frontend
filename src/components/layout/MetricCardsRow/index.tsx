import { cn } from "@/lib/cn";

type MetricCardsRowProps = {
  children: React.ReactNode;
  className?: string;
};

/**
 * The Workpex KPI carousel scrolls sideways rather than wrapping.
 *
 * Snap targets and shrink are applied to the children from here, so a metric card never
 * needs to know it lives in a carousel. `pb-2` reserves the slim scrollbar's track so it
 * cannot sit on top of the cards.
 */
export function MetricCardsRow({ children, className }: MetricCardsRowProps) {
  return (
    <div
      className={cn(
        "scrollbar-slim flex w-full min-w-0 snap-x snap-mandatory gap-4 overflow-x-auto pb-2 [&>*]:shrink-0 [&>*]:snap-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
