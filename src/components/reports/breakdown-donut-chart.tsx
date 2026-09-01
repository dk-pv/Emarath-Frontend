import { cn } from "@/lib/cn";

/**
 * A fixed six-hue cycle for buckets that carry no catalogue colour (sources, owners). Read
 * by row index, so a legend dot and its arc always agree. Literal classes, so Tailwind emits
 * them.
 */
export const DONUT_PALETTE = [
  { arc: "text-lime-400", swatch: "bg-lime-400" },
  { arc: "text-blue-400", swatch: "bg-blue-400" },
  { arc: "text-pink-400", swatch: "bg-pink-400" },
  { arc: "text-amber-300", swatch: "bg-amber-300" },
  { arc: "text-lime-300", swatch: "bg-lime-300" },
  { arc: "text-cyan-300", swatch: "bg-cyan-300" },
] as const;

/** Donut geometry: a 200-unit box, ring radius and stroke sized to the reference. */
const SIZE = 200;
const RADIUS = 82;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type DonutSlice = {
  id: string;
  label: string;
  count: number;
  /** Text-colour class the arc strokes with (`stroke="currentColor"`). */
  arcClass: string;
  /** Background class for the legend dot. */
  swatchClass: string;
};

export type BreakdownDonutChartProps = {
  slices: DonutSlice[];
  /** The server's distinct-lead total, printed in the centre. */
  total: number;
  /**
   * What the slices are shares of, when that differs from `total` — per-owner counts sum
   * past the distinct total because a co-assigned lead counts for each owner. Defaults to
   * `total`.
   */
  sliceTotal?: number;
  /** What the ring counts, for assistive tech ("leads by status"). */
  subject: string;
  /** Narrows the report to one slice; the legend rows are buttons when given. */
  onSelect?: (id: string) => void;
};

/**
 * A report's side panel, matched to the supplied references: a donut whose arcs are the
 * per-bucket counts, the total in its centre, and a scrolling legend of "● Label (count)"
 * beneath. Each report supplies its own colours (Stage colours for statuses, a fixed
 * palette for sources), so the chart itself never invents a hue.
 *
 * Dependency-free SVG: each arc is one circle with a dash sized to its share, rotated to
 * start where the previous arc ended. Shares use the server total, not a client re-sum,
 * so the ring and the table describe the same number.
 */
export function BreakdownDonutChart({
  slices,
  total,
  sliceTotal = total,
  subject,
  onSelect,
}: BreakdownDonutChartProps) {
  // Each arc starts where the previous one ended: a running prefix sum of the shares.
  const arcs = slices.reduce<
    { slice: DonutSlice; share: number; start: number }[]
  >((acc, slice) => {
    const share = sliceTotal > 0 ? slice.count / sliceTotal : 0;
    const previous = acc[acc.length - 1];
    const start = previous ? previous.start + previous.share : 0;
    return [...acc, { slice, share, start }];
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center p-5">
        <div className="relative size-52">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`${total.toLocaleString("en-US")} ${subject}`}
            className="size-full -rotate-90"
          >
            {/* Track, so an empty result still reads as a ring. */}
            <circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              fill="none"
              strokeWidth={STROKE}
              className="stroke-current text-canvas"
            />
            {arcs.map(({ slice, share, start }) =>
              share > 0 ? (
                <circle
                  key={slice.id}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray={`${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-start * CIRCUMFERENCE}
                  className={cn("stroke-current", slice.arcClass)}
                >
                  <title>
                    {slice.label}: {slice.count.toLocaleString("en-US")}
                  </title>
                </circle>
              ) : null,
            )}
          </svg>
          <span className="absolute inset-0 flex items-center justify-center text-base font-medium text-ink">
            Total {total.toLocaleString("en-US")}
          </span>
        </div>
      </div>

      <ul className="scrollbar-slim flex max-h-[26rem] flex-col overflow-y-auto border-t border-hairline px-4 py-3">
        {slices.map((slice) => {
          const label = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  slice.swatchClass,
                )}
              />
              <span className="min-w-0 truncate">{slice.label}</span>
              <span className="shrink-0 text-ink-muted">
                ({slice.count.toLocaleString("en-US")})
              </span>
            </>
          );
          return (
            <li key={slice.id}>
              {onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(slice.id)}
                  className="focus-ring-inset flex w-full items-center gap-3 rounded-control px-2 py-2 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
                >
                  {label}
                </button>
              ) : (
                <span className="flex items-center gap-3 px-2 py-2 text-sm text-ink">
                  {label}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
