"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { isAbortError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { periodKey } from "@/lib/dashboard-period";
import {
  fetchLeadsConversion,
  type LeadsConversion as Conversion,
  type LeadsConversionBreakdown,
  type LeadsConversionRow,
} from "@/services/dashboard-service";
import { useWidgetPeriod } from "./dashboard-widget";

const COUNT = new Intl.NumberFormat("en-US");

const BREAKDOWNS: readonly {
  value: LeadsConversionBreakdown;
  label: string;
}[] = [
  { value: "source", label: "Lead Source" },
  { value: "team", label: "Sales Team" },
];

/**
 * Chart geometry, measured off
 * dashboard-sidebar-collapsed-leads-vs-conversion-sales-team-toggle.png at 1:1 and
 * taken to the product's density (ADR-0076, × 0.9):
 *
 *   bar 39 → 35 · gap between the pair 5 → 5 · gap between groups 85 → 76 ·
 *   plot height 472 → 425 · four gridline intervals of 118 → 106
 */
const PLOT_HEIGHT = 425;
const BAR_W = "w-[35px]";
const PAIR_GAP = "gap-[5px]";
const GROUP_GAP = "gap-[76px]";

/** The reference draws four labelled gridlines plus the baseline. */
const TICKS = 4;

/**
 * The axis maximum: a round number at or above the largest bar, divided into four
 * whole-number ticks.
 *
 * The scale is read from the data, never fixed — the two captures show 1500…6000 in
 * one and 350…1400 in the other, on the same widget. Counts are integers, so the
 * tick is rounded up to one; without that a small chart would label itself 2.5 / 5 /
 * 7.5 / 10.
 */
export function axisMax(dataMax: number): number {
  if (dataMax <= 0) return TICKS;
  const raw = dataMax / TICKS;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const normalized = raw / magnitude;
  const step =
    [1, 1.5, 2, 2.5, 3, 4, 5, 7.5, 10].find((s) => normalized <= s) ?? 10;
  return Math.max(1, Math.ceil(step * magnitude)) * TICKS;
}

type Hover = { category: string; metric: string; value: number } | null;

/**
 * One category: the two bars, side by side and sharing a baseline.
 *
 * Grouped, never stacked — the reference draws Lead Count and Converted Count as
 * neighbours, and a converted lead is a subset of its category's leads, so stacking
 * them would double-count the same records into one column.
 */
function BarGroup({
  row,
  max,
  onHover,
}: {
  row: LeadsConversionRow;
  max: number;
  onHover: (hover: Hover) => void;
}) {
  const bars = [
    { metric: "Lead Count", value: row.leadCount, fill: "bg-chart-lead" },
    {
      metric: "Converted Count",
      value: row.convertedCount,
      fill: "bg-chart-converted",
    },
  ];
  return (
    <div className="flex shrink-0 flex-col items-center">
      <div
        className={cn("flex items-end", PAIR_GAP)}
        style={{ height: PLOT_HEIGHT }}
      >
        {bars.map((bar) => (
          <div
            key={bar.metric}
            role="img"
            aria-label={`${row.category}, ${bar.metric}: ${COUNT.format(bar.value)}`}
            onMouseEnter={() =>
              onHover({
                category: row.category,
                metric: bar.metric,
                value: bar.value,
              })
            }
            onMouseLeave={() => onHover(null)}
            className={cn(BAR_W, "rounded-t-sm", bar.fill)}
            // A zero keeps a hairline so the category still reads as present, the
            // way the reference's near-empty columns do.
            style={{
              height: `${Math.max((bar.value / max) * 100, bar.value > 0 ? 0.4 : 0.2)}%`,
            }}
          />
        ))}
      </div>
      <span className="mt-2 max-w-[151px] truncate text-sm text-ink-soft">
        {row.category}
      </span>
    </div>
  );
}

/**
 * Leads vs Conversion (DASH-11.2).
 *
 * A grouped bar chart of leads and, of those, the converted ones — broken down by
 * acquisition source or by sales team member. Both series come from one response, so
 * a pair of bars always describes the same query.
 *
 * **The toggle changes the query, not a caption.** `breakdown` is sent to the API,
 * which groups by `Lead.source` or by the assignee through `LeadAssignment`;
 * switching refetches and the categories change with it.
 *
 * Built from layout boxes rather than SVG: these are rectangles on a shared
 * baseline, which CSS already draws, and the project ships no charting library (the
 * one other chart, the Lead Source donut, is hand-rolled SVG because arcs need it).
 *
 * The widget owns its own period (DASH-01.2), so changing it here cannot touch a
 * sibling widget.
 */
export function LeadsConversion() {
  /**
   * The period is kept but no longer exposed: the reference draws no date control on
   * this widget, so the chip is gone and the widget stays on its established
   * default. `range` still reaches the API, which keeps its period support — the
   * endpoint is unchanged and other callers are unaffected.
   */
  const { period, range } = useWidgetPeriod("this-month");
  const [breakdown, setBreakdown] =
    useState<LeadsConversionBreakdown>("source");
  const [reloadToken, setReloadToken] = useState(0);
  const [hover, setHover] = useState<Hover>(null);

  const [loaded, setLoaded] = useState<{
    key: string;
    data: Conversion;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // Period and breakdown together identify a request; tagging the result with the
  // key stops a slow earlier response repainting over a newer one.
  const key = `${periodKey(period, range)}|${breakdown}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchLeadsConversion(range, breakdown, controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ key, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone.
        console.error("Leads vs Conversion failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, breakdown, reloadToken]);

  const current = loaded?.key === key ? loaded.data : null;
  const isError = failed === key;

  const rows = current?.rows ?? [];
  const max = axisMax(
    rows.reduce((top, row) => Math.max(top, row.leadCount), 0),
  );
  // Bottom-to-top, so tick i sits at i/4 of the plot height.
  const ticks = Array.from(
    { length: TICKS },
    (_, i) => ((i + 1) * max) / TICKS,
  );

  return (
    <Card as="section" className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink">Leads vs Conversion</h2>
        {/* The same pale-green trough the Lead Source Summary toggle sits in — one
            segmented control across the Dashboard. */}
        <SegmentedControl
          options={BREAKDOWNS}
          value={breakdown}
          onChange={setBreakdown}
          aria-label="Leads vs Conversion breakdown"
          className="border-brand/25 bg-brand-subtle [&>button[aria-pressed=false]]:text-brand [&>button[aria-pressed=false]]:hover:bg-brand/10"
        />
      </div>

      {isError ? (
        <ErrorState
          title="Couldn’t load Leads vs Conversion"
          description="Something went wrong loading this widget. Check your connection and try again."
          onRetry={() => {
            setFailed(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : current === null ? (
        // A skeleton at the plot's own height, so switching breakdown or period
        // never shifts the page and stale bars are never shown as the new answer.
        <Skeleton className="h-[500px] w-full rounded-surface" />
      ) : rows.length === 0 ? (
        <div className="flex min-h-125 items-center justify-center">
          <EmptyState
            title="No leads in this period"
            description="No leads were recorded for the selected period."
          />
        </div>
      ) : (
        <div className="relative flex flex-col gap-4">
          {/* The top tick label is centred on the plot's top edge, so half of it
              sits above the box — the reference leaves ~40px at 1:1 (36 here)
              between the title row and that first gridline. */}
          <div className="flex gap-2 pt-4">
            {/* The axis stays put while the categories scroll under it, as the
                reference's scrollbar (which starts after these labels) shows. */}
            <div
              aria-hidden="true"
              className="relative w-11 shrink-0"
              style={{ height: PLOT_HEIGHT }}
            >
              {ticks.map((tick, index) => (
                <span
                  key={tick}
                  className="absolute right-0 -translate-y-1/2 text-xs text-ink-muted"
                  style={{ bottom: `${((index + 1) / TICKS) * 100}%` }}
                >
                  {COUNT.format(tick)}
                </span>
              ))}
            </div>

            <div className="relative min-w-0 flex-1">
              {/* Dashed rules behind the bars, including the baseline. Drawn in the
                  fixed wrapper rather than inside the scroller so they always span
                  the visible plot. */}
              <div
                aria-hidden="true"
                className="pointer-events-none absolute inset-x-0 top-0"
                style={{ height: PLOT_HEIGHT }}
              >
                {[0, ...ticks].map((tick, index) => (
                  <span
                    key={tick}
                    className="absolute inset-x-0 border-t border-dashed border-chart-grid"
                    style={{ bottom: `${(index / TICKS) * 100}%` }}
                  />
                ))}
              </div>

              {/* Only the categories scroll; the page never does (DASH-11.2). */}
              <div className="scrollbar-slim overflow-x-auto overflow-y-hidden pb-1">
                <div className={cn("flex w-max items-end px-2", GROUP_GAP)}>
                  {rows.map((row) => (
                    <BarGroup
                      key={row.category}
                      row={row}
                      max={max}
                      onHover={setHover}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* The reference's legend: two swatches, centred under the plot. */}
          <ul className="flex flex-wrap items-center justify-center gap-6">
            {[
              { label: "Lead Count", fill: "bg-chart-lead" },
              { label: "Converted Count", fill: "bg-chart-converted" },
            ].map((entry) => (
              <li
                key={entry.label}
                className="flex items-center gap-2 text-sm text-ink"
              >
                <span
                  aria-hidden="true"
                  className={cn("size-[18px] shrink-0 rounded-xs", entry.fill)}
                />
                {entry.label}
              </li>
            ))}
          </ul>

          {/* The Sales Pipeline reference's tooltip, reused: the category, then the
              metric and its value. Anchored to the card, so it cannot overflow. */}
          {hover && (
            <div
              role="status"
              className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 rounded-control bg-ink px-3 py-2 shadow-lg"
            >
              <p className="truncate text-sm font-medium text-white">
                {hover.category}
              </p>
              <p className="mt-1 text-sm text-white">
                {hover.metric}:{" "}
                <span className="font-semibold">
                  {COUNT.format(hover.value)}
                </span>
              </p>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
