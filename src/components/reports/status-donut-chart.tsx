import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
import type { StatusCountRow } from "@/services/leads-by-status-report-service";

/** Donut geometry: a 200-unit box, ring radius and stroke sized to the reference. */
const SIZE = 200;
const RADIUS = 82;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

export type StatusDonutChartProps = {
  rows: StatusCountRow[];
  /** The server's distinct-lead total, printed in the centre. */
  total: number;
  /** Narrows the report to one status; the legend rows are buttons when given. */
  onSelectStatus?: (status: string) => void;
};

/**
 * The Leads By Status side panel, matched to the supplied reference: a donut whose arcs
 * are the per-status counts in each status's real Stage colour, the total in its centre,
 * and a scrolling legend of "● Status (count)" beneath.
 *
 * Dependency-free SVG: each arc is one circle with a dash sized to its share, rotated to
 * start where the previous arc ended. Colours come from `stageColorClasses().arc` — the
 * same catalogue the badges and the board read — so an arc can never disagree with its
 * pill. Percentages use the server total, not a client re-sum, so the ring and the table
 * describe the same number.
 */
export function StatusDonutChart({
  rows,
  total,
  onSelectStatus,
}: StatusDonutChartProps) {
  // Each arc starts where the previous one ended: a running prefix sum of the shares.
  const arcs = rows.reduce<
    { row: StatusCountRow; share: number; start: number }[]
  >((acc, row) => {
    const share = total > 0 ? row.count / total : 0;
    const previous = acc[acc.length - 1];
    const start = previous ? previous.start + previous.share : 0;
    return [...acc, { row, share, start }];
  }, []);

  return (
    <div className="flex flex-col">
      <div className="flex items-center justify-center p-5">
        <div className="relative size-52">
          <svg
            viewBox={`0 0 ${SIZE} ${SIZE}`}
            role="img"
            aria-label={`${total.toLocaleString("en-US")} leads by status`}
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
            {arcs.map(({ row, share, start }) =>
              share > 0 ? (
                <circle
                  key={row.status}
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  strokeWidth={STROKE}
                  strokeDasharray={`${share * CIRCUMFERENCE} ${CIRCUMFERENCE}`}
                  strokeDashoffset={-start * CIRCUMFERENCE}
                  className={cn(
                    "stroke-current",
                    stageColorClasses(row.color).arc,
                  )}
                >
                  <title>
                    {row.status}: {row.count.toLocaleString("en-US")}
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
        {rows.map((row) => {
          const label = (
            <>
              <span
                aria-hidden="true"
                className={cn(
                  "size-3 shrink-0 rounded-full",
                  stageColorClasses(row.color).swatch,
                )}
              />
              <span className="min-w-0 truncate">{row.status}</span>
              <span className="shrink-0 text-ink-muted">
                ({row.count.toLocaleString("en-US")})
              </span>
            </>
          );
          return (
            <li key={row.status}>
              {onSelectStatus ? (
                <button
                  type="button"
                  onClick={() => onSelectStatus(row.status)}
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
