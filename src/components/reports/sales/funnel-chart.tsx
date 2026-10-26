import { IconArrowDown } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  formatCount,
  formatRatio,
  funnelWidths,
  lowestStep,
  stepRatio,
} from "@/lib/sales-reports";
import type { SalesFunnelStageRow } from "@/services/sales-funnel-report-service";

/** One step's height and the gap below it (52px pitch), from both funnel captures. */
const STEP = 47;
const GAP = 5;
/**
 * The widest step and the funnel's centre line, as shares of the drawing column (the panel
 * less its 20px padding): 478px wide on a 354px centre in the Oct 2026 captures' 742px panel,
 * left of centre to leave the values room.
 */
const MAX_WIDTH = 68;
const CENTRE = 47.7;

/**
 * The Funnel Movement drawing: one trapezoid per stage, its top as wide as its own count and its
 * bottom as wide as the next stage's (widths per `funnelWidths`), the stage name and count in
 * white — a long name cut short before its count, as Workpex cuts "CS NUMBER Rec..." — the value
 * to its right, and the next ÷ previous badge on each join: the steepest drop warned, none after
 * an empty step. Drawn with clip-paths so the panel can be any width.
 */
export function FunnelChart({
  rows,
}: {
  rows: readonly SalesFunnelStageRow[];
}) {
  const widths = funnelWidths(rows.map((row) => row.count));
  const ratios = rows.map((row, index) =>
    index > 0 ? stepRatio(rows[index - 1].count, row.count) : null,
  );
  const steepest = lowestStep(ratios);

  return (
    <div className="scrollbar-slim overflow-x-auto px-5 pt-8 pb-7">
      <ol
        aria-label="Funnel movement"
        className="relative min-w-[460px] list-none"
        style={{ height: rows.length * (STEP + GAP) - GAP }}
      >
        {rows.map((row, index) => {
          const top = widths[index] * MAX_WIDTH;
          const bottom = (widths[index + 1] ?? widths[index]) * MAX_WIDTH;
          const box = Math.max(top, bottom);
          const inset = (width: number) => ((1 - width / box) / 2) * 100;
          const ratio = ratios[index];
          const label = row.count
            ? `${row.stage.name} (${formatCount(row.count)})`
            : row.stage.name;

          return (
            <li
              key={row.stage.id}
              className="absolute inset-x-0"
              style={{ top: index * (STEP + GAP), height: STEP }}
            >
              <div
                className={cn(
                  "absolute inset-y-0 flex -translate-x-1/2 items-center justify-center",
                  stageColorClasses(row.stage.color).swatch,
                )}
                style={{
                  left: `${CENTRE}%`,
                  width: `${box}%`,
                  clipPath: `polygon(${inset(top)}% 0, ${100 - inset(top)}% 0, ${100 - inset(bottom)}% 100%, ${inset(bottom)}% 100%)`,
                }}
              >
                <span
                  title={label}
                  className="flex min-w-0 items-center gap-3 text-sm font-semibold text-white"
                  // The trapezoid's width at mid-height, where the label sits, less a margin
                  // either side: "NOT REACHEBLE (1,459)" fits over a 127-lead step, as in Workpex.
                  style={{
                    maxWidth: `calc(${((top + bottom) / 2 / box) * 100}% - 24px)`,
                  }}
                >
                  <span className="min-w-0 truncate">{row.stage.name}</span>
                  {row.count > 0 && (
                    <span className="shrink-0">({formatCount(row.count)})</span>
                  )}
                </span>
              </div>
              <span
                className="absolute top-1/2 -translate-y-1/2 text-sm whitespace-nowrap text-ink-soft"
                style={{ left: `calc(${CENTRE + box / 2}% + 13px)` }}
              >
                <bdi dir="ltr">{formatAED(row.totalValue)}</bdi>
              </span>
              {ratio !== null && (
                <span
                  className={cn(
                    "absolute top-0 z-10 flex h-[18px] -translate-x-1/2 -translate-y-[calc(50%+2.5px)] items-center gap-0.5 rounded-full border px-2 text-[11px] font-medium",
                    ratio === steepest
                      ? "border-funnel-warn/60 bg-funnel-warn-tint text-funnel-warn"
                      : "border-hairline bg-surface text-ink-soft",
                  )}
                  style={{ left: `${CENTRE}%` }}
                >
                  <IconArrowDown size={11} stroke={2} aria-hidden="true" />
                  {formatRatio(ratio)}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </div>
  );
}
