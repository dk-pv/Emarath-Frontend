import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  COVERAGE_LABELS,
  coveragePosition,
  formatCount,
  formatCoverage,
} from "@/lib/sales-reports";
import type { SalesFunnelStageRow } from "@/services/sales-funnel-report-service";
import type {
  CoverageStatus,
  SalesPipelineReport,
} from "@/services/sales-pipeline-report-service";

/** Semicircle geometry at this density: 284px wide, a 23px round-capped stroke (July capture). */
const R = 130;
const STROKE = 23;
const SIZE = 2 * R + STROKE;
const ARC = `M ${STROKE / 2} ${R + STROKE / 2} A ${R} ${R} 0 0 1 ${SIZE - STROKE / 2} ${R + STROKE / 2}`;

function Money({ value }: { value: string | null }) {
  return <bdi dir="ltr">{formatAED(value)}</bdi>;
}

/**
 * Revenue achieved vs Revenue target (This Month): the Dashboard's Team Revenue rules — WON value
 * converted this month against the scoped members' monthly goals — drawn as Workpex draws them:
 * the amounts and the percentage above, a 180° gauge filled to the share (full once the target
 * is met), achieved under its left end and the target under its right. Workpex's centre reads
 * 100 % beside a 5473 % badge; here both print the same uncapped percentage, so they agree.
 */
export function RevenueGauge({
  revenue,
}: {
  revenue: SalesPipelineReport["revenue"];
}) {
  const pct = revenue.percent;
  const fill = pct === null ? 0 : Math.min(Math.max(pct, 0), 100);

  return (
    <div className="flex flex-col">
      <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] font-medium text-ink">
        <Money value={revenue.achieved} />
        <span className="text-xs font-normal text-ink-muted">of</span>
        <Money value={revenue.target} />
        <span className="rounded-full bg-green-50 px-2 py-0.5 text-[11px] font-semibold text-gauge">
          {pct === null ? "No target set" : `${Math.round(pct)}% achieved`}
        </span>
      </p>

      <div className="mx-auto mt-[52px] flex w-[284px] max-w-full flex-col">
        <div className="relative">
          <svg
            viewBox={`0 0 ${SIZE} ${R + STROKE}`}
            className="w-full overflow-visible"
            role="img"
            aria-label={
              pct === null
                ? "No revenue target set"
                : `${Math.round(pct)}% of target achieved`
            }
          >
            <path
              d={ARC}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              className="stroke-hairline"
            />
            {fill > 0 && (
              <path
                d={ARC}
                fill="none"
                strokeWidth={STROKE}
                strokeLinecap="round"
                pathLength={100}
                strokeDasharray={`${fill} 100`}
                className="stroke-gauge"
              />
            )}
            {fill > 0 && (
              <circle
                r={5}
                className="fill-surface"
                cx={SIZE / 2 - R * Math.cos((fill / 100) * Math.PI)}
                cy={R + STROKE / 2 - R * Math.sin((fill / 100) * Math.PI)}
              />
            )}
          </svg>
          <div className="absolute inset-x-0 bottom-7 flex flex-col items-center">
            <span className="text-[30px] leading-none font-bold text-gauge">
              {pct === null ? "NA" : `${Math.round(pct)}%`}
            </span>
            <span className="mt-1.5 text-[11px] font-medium tracking-wide text-ink-muted uppercase">
              of target achieved
            </span>
          </div>
        </div>
        <div className="mt-1 flex justify-between gap-4 text-center">
          <span className="flex flex-col text-[11.5px] font-semibold text-danger">
            <Money value={revenue.achieved} />
            <span className="text-[9px] font-medium uppercase">
              Revenue achieved
            </span>
          </span>
          <span className="flex flex-col text-[11.5px] font-semibold text-gauge">
            <Money value={revenue.target} />
            <span className="text-[9px] font-medium uppercase">
              Revenue target
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

const ZONES = [
  { label: "Critical <1.5×", track: "bg-coverage-critical", key: "bg-red-100" },
  { label: "Risk 1.5–3×", track: "bg-coverage-risk", key: "bg-amber-100" },
  { label: "On track ≥3×", track: "bg-coverage-ok", key: "bg-green-100" },
] as const;

/** The marker and "now" pill take their zone's colour; Workpex's capture shows Critical's red. */
const MARKER: Record<CoverageStatus, string> = {
  critical: "bg-danger",
  risk: "bg-warning",
  "on-track": "bg-gauge",
};

/** The status badge beside the ratio, in its zone's tint (`Critical` in the capture). */
export function CoverageBadge({ status }: { status: CoverageStatus | null }) {
  if (status === null) return null;
  return (
    <span
      className={cn(
        "rounded-full px-2.5 py-0.5 text-xs font-semibold",
        status === "critical" && "bg-red-50 text-danger",
        status === "risk" && "bg-amber-50 text-warning",
        status === "on-track" && "bg-green-50 text-gauge",
      )}
    >
      {COVERAGE_LABELS[status]}
    </span>
  );
}

/**
 * The 3× coverage track (`analytics-sales-pipeline-health-top-2026-10.png`): 0× to 5×+ in three
 * zones — critical below 1.5×, risk to 3×, on track beyond — with the "now" marker where the
 * ratio sits. Without a ratio (no target) the track draws without a marker.
 */
export function CoverageBar({
  coverage,
}: {
  coverage: SalesPipelineReport["coverage"];
}) {
  const { ratio, status } = coverage;
  const at = ratio === null ? null : coveragePosition(ratio);
  const tone = status === null ? "bg-danger" : MARKER[status];

  // The track sits 24px further in than the panel heading, both sides (the Oct capture).
  return (
    <div className="flex flex-col px-6">
      <div className="relative mt-17 h-6">
        <div className="flex h-full overflow-hidden rounded-full">
          <span className={cn("w-[30%]", ZONES[0].track)} />
          <span className={cn("w-[30%]", ZONES[1].track)} />
          <span className={cn("flex-1", ZONES[2].track)} />
        </div>
        {at !== null && (
          <>
            <span
              className={cn(
                "absolute bottom-full mb-2 -translate-x-1/2 rounded-md px-2.5 py-1 text-xs font-bold whitespace-nowrap text-white",
                tone,
              )}
              style={{ left: `clamp(3rem, ${at}%, calc(100% - 3rem))` }}
            >
              {formatCoverage(ratio)} now
            </span>
            <span
              className={cn(
                "absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface",
                tone,
              )}
              style={{ left: `clamp(0.6rem, ${at}%, calc(100% - 0.6rem))` }}
            />
          </>
        )}
      </div>
      <div className="relative mt-1 h-4 text-[11px] font-semibold text-ink-soft">
        <span className="absolute left-[30%] -translate-x-1/2">1.5× risk</span>
        <span className="absolute left-[60%] -translate-x-1/2">3× target</span>
      </div>
      <div className="mt-7 flex justify-between text-[11px] font-semibold text-ink-subtle">
        {["0×", "1×", "2×", "3×", "4×", "5×+"].map((tick) => (
          <span key={tick}>{tick}</span>
        ))}
      </div>
      <ul className="mt-[30px] flex flex-wrap gap-x-6 gap-y-2 text-[11px] font-medium text-ink-soft">
        {ZONES.map((zone) => (
          <li key={zone.label} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className={cn("size-3 rounded-sm", zone.key)}
            />
            {zone.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Pipeline by Stage: one bar per open stage, scaled against the busiest — the Dashboard's Sales
 * Pipeline idiom; no capture shows this panel populated.
 */
export function StageBars({ rows }: { rows: readonly SalesFunnelStageRow[] }) {
  const max = Math.max(...rows.map((row) => row.count), 0);

  return (
    <ul className="flex flex-col gap-4 p-5">
      {rows.map((row) => (
        <li
          key={row.stage.id}
          className="grid grid-cols-[minmax(0,9rem)_minmax(0,1fr)_minmax(0,8.5rem)] items-center gap-3 text-xs"
        >
          <span className="truncate text-ink-soft" title={row.stage.name}>
            {row.stage.name}
          </span>
          <span className="h-4 overflow-hidden rounded-full bg-canvas">
            {row.count > 0 && (
              <span
                className={cn(
                  "block h-full rounded-full",
                  stageColorClasses(row.stage.color).swatch,
                )}
                style={{ width: `${(row.count / max) * 100}%` }}
              />
            )}
          </span>
          <span className="truncate text-right text-ink tabular-nums">
            {formatCount(row.count)} ·{" "}
            <bdi dir="ltr">{formatAED(row.totalValue)}</bdi>
          </span>
        </li>
      ))}
    </ul>
  );
}
