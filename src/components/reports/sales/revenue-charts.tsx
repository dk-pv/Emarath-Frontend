import {
  IconTrendingDown,
  IconTrendingUp,
  type Icon,
} from "@tabler/icons-react";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import { formatCount } from "@/lib/sales-reports";
import { formatRate, niceScale } from "@/lib/revenue-report";
import type {
  RevenueOverview,
  RevenuePipelineRow,
  RevenueSourceRow,
} from "@/services/revenue-report-service";
import type { TableColumn } from "@/types";
import { KPI_ACCENTS, type KpiAccent } from "./sales-report-parts";

function Money({ value }: { value: string | number | null }) {
  return <bdi dir="ltr">{formatAED(value)}</bdi>;
}

/**
 * A figure's change on the comparison window, as the capture's green line draws it ("↗ 92306.6%
 * vs last quarter"); a fall in red with its minus sign. A dash where nothing compares.
 */
function ChangeLine({
  change,
  comparison,
}: {
  change: number | null;
  comparison: string | null;
}) {
  if (comparison === null) return <span className="h-3.5" />;
  if (change === null) {
    return (
      <p className="truncate text-[10.5px] leading-3.5 text-ink-subtle">
        — {comparison}
      </p>
    );
  }
  const fell = change < 0;
  const Glyph = fell ? IconTrendingDown : IconTrendingUp;
  return (
    <p
      className={cn(
        "flex min-w-0 items-center gap-1 text-[10.5px] leading-3.5",
        fell ? "text-danger" : "text-green-600",
      )}
    >
      <Glyph size={14} stroke={2} aria-hidden="true" className="shrink-0" />
      <span className="truncate">
        {fell ? "−" : ""}
        {formatRate(Math.abs(change))} {comparison}
      </span>
    </p>
  );
}

/**
 * One of the four figure cards (`analytics-revenue-report-overview-top-2026-10.png`, 288×128):
 * title and round icon badge, the figure low in the card, the comparison line under it — the
 * Analytics card family's accents and glow, at this report's size.
 */
export function RevenueKpiCard({
  title,
  icon: Glyph,
  accent,
  value,
  change,
  comparison,
}: {
  title: string;
  icon: Icon;
  accent: KpiAccent;
  value: React.ReactNode;
  change: number | null;
  comparison: string | null;
}) {
  const tone = KPI_ACCENTS[accent];
  return (
    <article
      className={cn(
        "kpi-glow flex min-h-[126px] min-w-0 flex-col rounded-[14px] border px-4 pt-2 pb-2.5",
        tone.surface,
      )}
    >
      <div className="flex items-center justify-between gap-3">
        <h3 className="min-w-0 truncate text-[13px] text-ink">{title}</h3>
        <span
          className={cn(
            "flex size-7.5 shrink-0 items-center justify-center rounded-full text-white",
            tone.badge,
          )}
        >
          <Glyph size={16} stroke={1.75} aria-hidden="true" />
        </span>
      </div>
      <div className="mt-auto truncate text-[17.5px] leading-7 font-bold text-ink">
        {value}
      </div>
      <div className="mt-2">
        <ChangeLine change={change} comparison={comparison} />
      </div>
    </article>
  );
}

/** The gauge's geometry: the capture's 99px-wide semicircle and 13px stroke, drawn 1:1 in CSS px. */
const R = 43;
const STROKE = 13;
const CX = 60;
const CY = 58;
const ARC = `M ${CX - R} ${CY} A ${R} ${R} 0 0 1 ${CX + R} ${CY}`;
const NEEDLE = 34;

/**
 * The target card (capture: "Quarterly target achievement", 1737 %): a semicircle filled to the
 * share achieved, its needle at the same point, 0 % and 100 % under its ends, the uncapped
 * percentage in its centre and "achieved of target" below. Past 100 % the arc stays full and the
 * needle stays at 100 %, while the centre keeps the real figure — overachievement reads as the
 * number, never as a clipped 100 %. Without a period target the card says why instead.
 */
export function TargetGaugeCard({
  title,
  target,
  revenue,
  loading,
}: {
  title: string;
  target: RevenueOverview["target"] | null;
  revenue: string | null;
  loading: boolean;
}) {
  const percent = target?.percent ?? null;
  const fill = percent === null ? 0 : Math.min(Math.max(percent, 0), 100);
  const angle = Math.PI * (1 - fill / 100);
  const reason =
    target === null
      ? null
      : target.monthly === null
        ? "No target set"
        : target.period === null
          ? "Targets are set per whole month"
          : null;

  return (
    <article className="flex min-h-[126px] min-w-0 flex-col items-center rounded-[14px] border border-cyan-500 bg-cyan-50 px-4 pt-1.5 pb-2.5">
      <h3 className="max-w-full truncate text-[13px] tracking-wide text-ink">
        {title}
      </h3>
      <div className="relative mt-0.5 w-[120px]">
        <svg
          viewBox={`0 0 120 ${CY + STROKE / 2 + 1}`}
          className="w-full overflow-visible"
          role="img"
          aria-label={
            percent === null
              ? (reason ?? "Target achievement")
              : `${Math.round(percent)}% of target achieved`
          }
        >
          <defs>
            <linearGradient id="revenue-gauge" x1="0" x2="1" y1="0" y2="0">
              <stop
                offset="0"
                className="[stop-color:var(--color-emerald-300)]"
              />
              <stop offset="1" className="[stop-color:var(--color-gauge)]" />
            </linearGradient>
          </defs>
          <path
            d={ARC}
            fill="none"
            strokeWidth={STROKE}
            strokeLinecap="round"
            className="stroke-cyan-100"
          />
          {fill > 0 && (
            <path
              d={ARC}
              fill="none"
              strokeWidth={STROKE}
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${fill} 100`}
              stroke="url(#revenue-gauge)"
            />
          )}
          {percent !== null && (
            <>
              <line
                x1={CX}
                y1={CY}
                x2={CX + NEEDLE * Math.cos(angle)}
                y2={CY - NEEDLE * Math.sin(angle)}
                strokeWidth={2.5}
                strokeLinecap="round"
                className="stroke-gauge"
              />
              <circle cx={CX} cy={CY} r={3.5} className="fill-gauge" />
            </>
          )}
        </svg>
        <div className="absolute inset-x-0 top-[34px] text-center text-[14px] leading-none font-bold text-gauge">
          {loading ? (
            <Skeleton className="mx-auto h-3.5 w-10" />
          ) : percent === null ? (
            "—"
          ) : (
            // On the card's tint, so the needle passes behind the figure, never through it.
            <span className="rounded bg-cyan-50 px-1">{`${Math.round(percent)}%`}</span>
          )}
        </div>
        <div className="-mt-0.5 flex justify-between px-1 text-[9px] leading-3 text-ink-subtle">
          <span>0%</span>
          <span>100%</span>
        </div>
      </div>
      <div className="mt-auto max-w-full truncate pt-1 text-[11.5px] text-ink">
        {loading ? (
          <Skeleton className="inline-block h-3.5 w-36 align-middle" />
        ) : reason !== null ? (
          <span className="text-ink-muted">{reason}</span>
        ) : target?.period ? (
          <>
            <Money value={revenue} /> of <Money value={target.period} />
          </>
        ) : null}
      </div>
    </article>
  );
}

/** A label every few buckets so a 31-day trend's dates never collide. */
const MAX_AXIS_LABELS = 12;

/**
 * Revenue Trend (`…overview-top-2026-10.png`): one bar per bucket on a 0–400,000-style axis
 * with dashed gridlines, the light-blue bars of the capture, and the monthly target as a dashed
 * amber line labelled in its middle. Each bar's tooltip names its bucket, revenue and deals.
 */
export function RevenueTrendChart({
  trend,
  labels,
  monthlyTarget,
}: {
  trend: RevenueOverview["trend"];
  labels: readonly string[];
  /** The members' monthly goals, drawn only on a monthly trend. */
  monthlyTarget: string | null;
}) {
  const target = monthlyTarget === null ? null : Number(monthlyTarget);
  const { top, ticks } = niceScale(
    Math.max(...trend.map((bucket) => Number(bucket.revenue)), target ?? 0),
  );
  const at = (value: number) => `${(value / top) * 100}%`;
  const every = Math.ceil(trend.length / MAX_AXIS_LABELS);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="flex h-[160px] min-w-0 xl:mr-20">
        <div className="relative w-[119px] shrink-0" aria-hidden="true">
          {ticks.map((tick) => (
            <span
              key={tick}
              style={{ bottom: at(tick) }}
              className="absolute right-2.5 translate-y-1/2 text-[10.5px] whitespace-nowrap text-ink-subtle"
            >
              <Money value={tick} />
            </span>
          ))}
        </div>
        <div className="relative min-w-0 flex-1">
          {ticks.map((tick) => (
            <span
              key={tick}
              aria-hidden="true"
              style={{ bottom: at(tick) }}
              className="absolute inset-x-0 border-t border-dashed border-chart-grid"
            />
          ))}
          <ul className="absolute inset-0 flex" aria-label="Revenue by period">
            {trend.map((bucket, index) => {
              const revenue = Number(bucket.revenue);
              const text = `${labels[index] ?? ""}: ${formatAED(revenue)} · ${formatCount(bucket.deals)} deal${bucket.deals === 1 ? "" : "s"}`;
              return (
                <li
                  key={bucket.from}
                  className="flex min-w-0 flex-1 border-l border-dashed border-chart-grid first:border-l-0"
                >
                  <Tooltip
                    content={text}
                    portal
                    className="flex h-full w-full items-end justify-center"
                  >
                    <span
                      tabIndex={0}
                      aria-label={text}
                      className="focus-ring flex h-full w-full items-end justify-center rounded-sm"
                    >
                      <span
                        style={{ height: at(revenue) }}
                        className="block w-[34%] max-w-14 min-w-0.5 rounded-t-[3px] bg-linear-to-b from-chart-converted to-blue-50"
                      />
                    </span>
                  </Tooltip>
                </li>
              );
            })}
          </ul>
          {target !== null && (
            <div
              style={{ bottom: at(target) }}
              className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-warning"
            >
              <span className="absolute bottom-0.5 left-1/2 -translate-x-1/2 text-[10.5px] font-semibold whitespace-nowrap text-warning">
                Monthly Target: <Money value={target} />
              </span>
            </div>
          )}
        </div>
      </div>
      <div className="ml-[119px] flex min-w-0 xl:mr-20" aria-hidden="true">
        {trend.map((bucket, index) => (
          <span
            key={bucket.from}
            className="min-w-0 flex-1 truncate pt-1 text-center text-[10.5px] text-ink-subtle"
          >
            {index % every === 0 ? labels[index] : ""}
          </span>
        ))}
      </div>
      <ul className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-[10.5px] text-ink-soft">
        <li className="flex items-center gap-1.5">
          <span
            aria-hidden="true"
            className="size-2.5 rounded-full bg-linear-to-br from-kpi-blue/80 to-chart-converted"
          />
          Revenue
        </li>
        {target !== null && (
          <li className="flex items-center gap-1.5">
            <span
              aria-hidden="true"
              className="w-4 border-t-2 border-dashed border-warning"
            />
            Monthly target
          </li>
        )}
      </ul>
    </div>
  );
}

/** "▲ 8173.3%" in green, a fall in red, a dash with nothing to compare (the capture). */
function PriorChange({ change }: { change: number | null }) {
  if (change === null) return <span className="text-ink-subtle">—</span>;
  const fell = change < 0;
  return (
    <span className={fell ? "text-danger" : "text-emerald-600"}>
      <span aria-hidden="true">{fell ? "▼" : "▲"} </span>
      <span className="sr-only">{fell ? "down " : "up "}</span>
      {formatRate(Math.abs(change))}
    </span>
  );
}

const SOURCE_HEAD =
  "bg-gray-50 py-1.5 text-[10px] leading-4 font-medium tracking-wide text-ink-subtle uppercase";

const SOURCE_COLUMNS: readonly TableColumn<RevenueSourceRow>[] = [
  {
    key: "source",
    header: "Source",
    headerClassName: SOURCE_HEAD,
    className: "py-1 text-[11.5px] text-ink",
    render: (row) => row.source,
  },
  {
    key: "revenue",
    header: "Revenue",
    headerClassName: SOURCE_HEAD,
    className: "py-1 text-[11.5px] text-ink",
    render: (row) => <Money value={row.revenue} />,
  },
  {
    key: "conversionRate",
    header: "Conv. Rate",
    headerClassName: SOURCE_HEAD,
    className: "py-1 text-[11.5px]",
    render: (row) =>
      row.conversionRate === null ? (
        <span className="text-ink-subtle">—</span>
      ) : (
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[11px] font-medium text-green-800">
          {formatRate(row.conversionRate)}
        </span>
      ),
  },
  {
    key: "change",
    header: "Vs Prior",
    headerClassName: SOURCE_HEAD,
    className: "py-1 text-[11.5px]",
    render: (row) => <PriorChange change={row.change} />,
  },
];

/**
 * Revenue By Lead Source (`…overview-top-2026-10.png`): source, revenue, conversion pill and the
 * change on the prior window, under a header that stays put while the rows scroll. A row opens
 * the Data Grid narrowed to that source.
 */
export function SourceTable({
  rows,
  onDrill,
}: {
  rows: readonly RevenueSourceRow[];
  onDrill: (source: string) => void;
}) {
  return (
    <Table
      columns={SOURCE_COLUMNS}
      rows={rows}
      getRowId={(row) => row.source}
      onRowClick={(row) => onDrill(row.source)}
    />
  );
}

/**
 * Revenue By Pipeline (`…overview-scrolled-2026-10.png`): each pipeline's revenue and win rate,
 * its bar filled to the win rate — the capture's one pipeline fills 81.6 % of its track beside an
 * 81.6 % Win Rate — so every bar shares the same 0–100 % baseline.
 */
export function PipelineRevenue({
  rows,
}: {
  rows: readonly RevenuePipelineRow[];
}) {
  const grid =
    "grid grid-cols-[minmax(0,8rem)_minmax(0,1fr)_minmax(0,7.5rem)_minmax(0,3.5rem)] items-center gap-x-4";
  return (
    <div className="px-4 pt-4 pb-5 sm:px-5">
      <div className={cn(grid, "text-[11px] text-ink-subtle")}>
        <span>Pipeline</span>
        <span aria-hidden="true" />
        <span className="text-right">Revenue</span>
        <span className="text-right">Win Rate</span>
      </div>
      <ul className="mt-3 flex flex-col gap-3">
        {rows.map((row) => (
          <li key={row.pipeline} className={cn(grid, "min-h-9")}>
            <span
              className="truncate pl-3 text-sm text-ink"
              title={row.pipeline}
            >
              {row.pipeline}
            </span>
            <span
              role="img"
              aria-label={`${row.pipeline}: ${row.winRate === null ? "no win rate" : `${formatRate(row.winRate)} win rate`}`}
              className="h-[11px] overflow-hidden rounded-full bg-gray-100"
            >
              {row.winRate !== null && row.winRate > 0 && (
                <span
                  className="block h-full rounded-full bg-blue-600"
                  style={{ width: `${Math.min(row.winRate, 100)}%` }}
                />
              )}
            </span>
            <span className="truncate text-right text-sm font-semibold text-ink">
              <Money value={row.revenue} />
            </span>
            <span className="text-right text-sm text-blue-600">
              {row.winRate === null ? "—" : formatRate(row.winRate)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
