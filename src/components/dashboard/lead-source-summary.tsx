"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { SegmentedControl } from "@/components/ui/SegmentedControl";
import { Skeleton } from "@/components/ui/Skeleton";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { isAbortError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { periodKey } from "@/lib/dashboard-period";
import { formatDayLabel } from "@/lib/format";
import {
  fetchLeadSourceSummary,
  type LeadSourceDateMode,
  type LeadSourceSummary as Summary,
} from "@/services/dashboard-service";
import { LeadSourceDonut } from "./lead-source-donut";
import { useWidgetPeriod } from "./dashboard-widget";

const COUNT = new Intl.NumberFormat("en-US");

const MODES: readonly { value: LeadSourceDateMode; label: string }[] = [
  { value: "created", label: "Created Date" },
  { value: "assigned", label: "Assigned Date" },
];

/**
 * Grid geometry, measured off
 * dashboard-header-search-expanded-lead-source-summary-donut-tooltip.png at 1:1 and
 * taken to the product's density (ADR-0076, × 0.9):
 *
 *   source column 163 → 147 · date column 86 → 78 · cell height 65 → 59 ·
 *   gap between cells 21 → 19
 *
 * The gap is `td` padding rather than `border-spacing`, deliberately: with separated
 * borders the space between cells is transparent, and rows scrolling under the
 * sticky source column would show through it. Padding keeps each cell's background
 * contiguous, so the sticky column is opaque all the way across.
 */
const SOURCE_COL = "w-[147px] min-w-[147px]";
const DATE_COL = "w-[78px] min-w-[78px]";
const CELL = "flex h-[59px] items-center justify-center rounded-lg text-sm";
const PAD = "p-[9.5px]";

/** Six rows of 78px pitch plus the 78px header — the reference's visible grid. */
const GRID_HEIGHT = "max-h-[468px]";

/**
 * One matrix cell. The reference's effect is binary, not a scale: a day with leads is
 * a pale lime tile with a lime rule and green figures, a day without is a bare
 * neutral one. Nothing in the capture varies with magnitude — Jul 06's 359 and
 * Jul 01's 26 are the same green — so no intensity ramp is invented here.
 */
function Cell({ value }: { value: number }) {
  if (value === 0) {
    return (
      <td className={PAD}>
        <div className={cn(CELL, "border border-hairline bg-canvas")} />
      </td>
    );
  }
  return (
    <td className={PAD}>
      <div
        className={cn(
          CELL,
          "border border-heat-cell-line bg-heat-cell text-heat-cell-ink",
        )}
      >
        {COUNT.format(value)}
      </div>
    </td>
  );
}

/**
 * The Dashboard's Lead Source Summary (DASH-10.2).
 *
 * **Two cards, not one.** The reference measures the matrix panel at 997px and the
 * donut panel at 632px with a 32px gutter of page canvas between them — a 61/39
 * split, which is the same `DashboardGrid` proportion the Call Activity and
 * Leads-Need-Attention rows already use. They are one widget in every other sense:
 * a single fetch feeds both, so the ring, its centre and the Total row can never
 * disagree.
 *
 * **The toggle changes the query, not a caption.** `mode` is sent to the API, which
 * aggregates on `Lead.createdAt` or `LeadAssignment.createdAt` accordingly; switching
 * refetches and every figure moves with it.
 *
 * The widget owns its own period (DASH-01.2) through `useWidgetPeriod`, so changing
 * it here cannot touch any sibling widget.
 */
export function LeadSourceSummary() {
  /**
   * The period is kept but no longer exposed: the reference draws no date control on
   * this widget, so the chip is gone and the widget simply stays on its established
   * default. `range` still reaches the API, which keeps its period support for the
   * other callers and needs no change.
   */
  const { period, range } = useWidgetPeriod("this-month");
  const [mode, setMode] = useState<LeadSourceDateMode>("created");
  const [reloadToken, setReloadToken] = useState(0);

  const [loaded, setLoaded] = useState<{ key: string; data: Summary } | null>(
    null,
  );
  const [failed, setFailed] = useState<string | null>(null);

  // Period and mode together identify a request. Tagging the result with the key is
  // what stops a slow earlier response repainting over a newer one, and lets the
  // effect avoid resetting state on its way in — the rule every Dashboard read here
  // follows.
  const key = `${periodKey(period, range)}|${mode}`;

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchLeadSourceSummary(range, mode, controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ key, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone.
        console.error("Lead Source Summary failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, mode, reloadToken]);

  const current = loaded?.key === key ? loaded.data : null;
  const isError = failed === key;

  // Descending total, so the dominant source leads both the ring and the legend
  // (DASH-10.2). Sorted from a copy — the API's own row order is alphabetical and
  // the matrix below still reads in it.
  const slices = current
    ? [...current.sources]
        .filter((row) => row.total > 0)
        .sort((a, b) => b.total - a.total || a.source.localeCompare(b.source))
        .map((row) => ({ source: row.source, total: row.total }))
    : [];

  const header = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      {/* 22px of ink at 1:1 → ~24px type, 20 at this density (ADR-0076). */}
      <h2 className="text-xl font-semibold text-ink">Lead Source Summary</h2>
      {/* The reference's toggle sits in a pale-green trough, not the shared control's
          white-on-hairline: container #eef9f0 with a #d9f2de rule, the active segment
          solid brand (#65ca7b is the reference's own green, sampled) and the inactive
          one brand-inked on the trough. Applied through the control's `aria-pressed`
          contract rather than by reaching into its markup. */}
      <SegmentedControl
        options={MODES}
        value={mode}
        onChange={setMode}
        aria-label="Lead Source Summary date mode"
        className="border-brand/25 bg-brand-subtle [&>button[aria-pressed=false]]:text-brand [&>button[aria-pressed=false]]:hover:bg-brand/10"
      />
    </div>
  );

  // A failed read collapses to one card: the widget as a whole could not answer, and
  // drawing an empty ring beside the message would imply a figure of zero.
  if (isError) {
    return (
      <Card as="section" className="flex flex-col gap-4 p-5">
        {header}
        <ErrorState
          title="Couldn’t load the Lead Source Summary"
          description="Something went wrong loading this widget. Check your connection and try again."
          onRetry={() => {
            setFailed(null);
            setReloadToken((token) => token + 1);
          }}
        />
      </Card>
    );
  }

  return (
    // The reference's own proportions: 997 / 632 across the content width with a
    // 32px gutter — the 60/38 split the Call Activity row already uses.
    <DashboardGrid className="gap-7 md:grid-cols-1 lg:grid-cols-[minmax(0,60fr)_minmax(0,38fr)] lg:gap-7 xl:grid-cols-[minmax(0,60fr)_minmax(0,38fr)]">
      <Card as="section" className="flex flex-col gap-4 p-5">
        {header}

        {current === null ? (
          // A skeleton at the grid's own height, so switching mode or period never
          // shifts the page and stale figures are never shown as if they were new.
          <Skeleton className="h-[468px] w-full rounded-surface" />
        ) : current.grandTotal === 0 ? (
          <div className="flex min-h-117 items-center justify-center">
            <EmptyState
              title="No leads in this period"
              description="No leads were recorded for the selected period and date mode."
            />
          </div>
        ) : (
          /*
           * The grid scrolls **inside** the card, both ways: many days scroll
           * horizontally, many sources vertically, and the page itself never
           * overflows. `scrollbar-slim` and not the Dashboard tables' hidden bar —
           * the reference draws visible scrollbars on this widget specifically, on
           * the right of the rows and under the columns.
           */
          <div
            role="region"
            aria-label="Lead source summary grid"
            tabIndex={0}
            className={cn(
              "focus-ring scrollbar-slim min-w-0 overflow-auto",
              GRID_HEIGHT,
            )}
          >
            <table className="border-separate border-spacing-0">
              <thead>
                <tr>
                  {/* The corner: above the source names, left of the dates, so it
                      has to outrank both sticky axes. */}
                  <th
                    scope="col"
                    className={cn(
                      "sticky top-0 left-0 z-30 bg-surface",
                      PAD,
                      SOURCE_COL,
                    )}
                  >
                    <span className="sr-only">Lead source</span>
                  </th>
                  {current.dates.map((date) => (
                    <th
                      key={date}
                      scope="col"
                      className={cn(
                        "sticky top-0 z-20 bg-surface",
                        PAD,
                        DATE_COL,
                      )}
                    >
                      <div
                        className={cn(
                          CELL,
                          "bg-canvas font-medium text-ink-soft",
                        )}
                      >
                        {formatDayLabel(date)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>

              <tbody>
                {current.sources.map((row) => (
                  <tr key={row.source}>
                    <th
                      scope="row"
                      className={cn(
                        "sticky left-0 z-10 bg-surface text-left",
                        PAD,
                        SOURCE_COL,
                      )}
                    >
                      <div
                        className={cn(
                          CELL,
                          "justify-start bg-canvas px-3 font-normal text-ink-soft",
                        )}
                      >
                        <span className="truncate" title={row.source}>
                          {row.source}
                        </span>
                      </div>
                    </th>
                    {row.values.map((value, index) => (
                      <Cell key={current.dates[index]} value={value} />
                    ))}
                  </tr>
                ))}
              </tbody>

              {/* Pinned to the bottom of the scroll box under a full-width rule, as
                  the reference keeps it visible with the source rows scrolled past
                  it. Its own label cell is neutral like every other source cell —
                  only the figures take the lime. */}
              <tfoot>
                <tr>
                  <th
                    scope="row"
                    className={cn(
                      "sticky bottom-0 left-0 z-30 border-t border-hairline bg-surface text-left",
                      PAD,
                      SOURCE_COL,
                    )}
                  >
                    <div
                      className={cn(
                        CELL,
                        "justify-start bg-canvas px-3 font-medium text-ink-soft",
                      )}
                    >
                      Total
                    </div>
                  </th>
                  {current.dailyTotals.map((total, index) => (
                    <td
                      key={current.dates[index]}
                      className={cn(
                        "sticky bottom-0 z-20 border-t border-hairline bg-surface",
                        PAD,
                        DATE_COL,
                      )}
                    >
                      <div
                        className={cn(
                          CELL,
                          "bg-heat-total font-medium text-heat-total-ink",
                        )}
                      >
                        {COUNT.format(total)}
                      </div>
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </Card>

      {/* The donut's own card, as the reference draws it. */}
      <Card as="section" className="flex items-center justify-center p-5">
        {current === null ? (
          <Skeleton className="h-[468px] w-full rounded-surface" />
        ) : (
          <LeadSourceDonut slices={slices} grandTotal={current.grandTotal} />
        )}
      </Card>
    </DashboardGrid>
  );
}
