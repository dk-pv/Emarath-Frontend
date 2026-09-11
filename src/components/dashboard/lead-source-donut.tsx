"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { sourceColor, type SourceColor } from "./lead-source-colors";

/**
 * Ring geometry, measured off
 * dashboard-header-search-expanded-lead-source-summary-donut-tooltip.png: a 358px
 * outer diameter with a 58px band at 1:1, so the band is 0.16 of the diameter. In a
 * 200-unit box that is a 32 stroke on an 84 radius, which fills the box exactly.
 */
const SIZE = 200;
const STROKE = 32;
const RADIUS = 84;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The reference separates its segments with a hairline of background. One unit of
 * the 200-box ≈ 1.8px at the rendered size — the gap the capture shows between the
 * small slices.
 */
const GAP = 1;

export type DonutSlice = { source: string; total: number };

const COUNT = new Intl.NumberFormat("en-US");

/**
 * The Lead Source Summary's donut (DASH-10.2).
 *
 * Dependency-free SVG, like the reports' `BreakdownDonutChart` — the project ships no
 * charting library and this needs no arithmetic that one would provide. It is a
 * separate component rather than a variant of that one because almost nothing about
 * the two is shared: this ring is half as thick again, its segments are separated,
 * its centre prints the bare figure rather than "Total N", and its legend is a
 * multi-column grid of names without counts. Warping four reports' chart to reach
 * that would cost more than the fifty lines here.
 *
 * Slices arrive **already ordered by the caller** (descending total), so the ring and
 * the legend read in the same order and the dominant source leads both.
 */
export function LeadSourceDonut({
  slices,
  grandTotal,
}: {
  slices: readonly DonutSlice[];
  grandTotal: number;
}) {
  const [hovered, setHovered] = useState<string | null>(null);

  // Each arc starts where the previous ended: a running prefix of the shares, folded
  // rather than accumulated into a `let` — the same shape the reports' donut uses,
  // and what the compiler's immutability rule requires. Shares are of the API's own
  // grand total, so the ring describes the number the Total row does rather than a
  // client re-sum of a partial set.
  const arcs = slices.reduce<
    (DonutSlice & SourceColor & { share: number; start: number })[]
  >((acc, slice) => {
    const share = grandTotal > 0 ? slice.total / grandTotal : 0;
    const previous = acc[acc.length - 1];
    const start = previous ? previous.start + previous.share : 0;
    return [...acc, { ...slice, share, start, ...sourceColor(slice.source) }];
  }, []);

  const active = arcs.find((arc) => arc.source === hovered);

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="relative w-full max-w-80">
        <svg
          viewBox={`0 0 ${SIZE} ${SIZE}`}
          role="img"
          aria-label={`${COUNT.format(grandTotal)} leads by source`}
          className="size-full -rotate-90"
        >
          {/* The track, so an empty period still reads as a ring rather than a hole. */}
          <circle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-current text-canvas"
          />
          {arcs.map((arc) => {
            const length = arc.share * CIRCUMFERENCE;
            if (length <= 0) return null;
            return (
              <circle
                key={arc.source}
                cx={SIZE / 2}
                cy={SIZE / 2}
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                // The gap is taken off the arc, never added between them, so the
                // segments still sum to one turn and a sliver never inverts.
                strokeDasharray={`${Math.max(length - GAP, 0.01)} ${CIRCUMFERENCE}`}
                strokeDashoffset={-arc.start * CIRCUMFERENCE}
                onMouseEnter={() => setHovered(arc.source)}
                onMouseLeave={() => setHovered(null)}
                // No hover dimming: the reference's capture shows the ring at full
                // strength behind its tooltip, and the tooltip alone names the
                // segment. Fading the others would be an affordance no screenshot
                // evidences.
                className={cn("stroke-current", arc.arc)}
              />
            );
          })}
        </svg>

        {/* Measured: the reference's digits stand 25px tall at 1:1, so ~35px type,
            32 at this density (ADR-0076) — and in `--color-ink-soft` (#505050,
            sampled), not the page ink. */}
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[32px] leading-none font-semibold text-ink-soft">
          {COUNT.format(grandTotal)}
        </span>

        {/* The reference's dark card: the source name over a swatch and its count.
            Anchored inside the ring rather than to the pointer, so it can never
            overflow the widget on a narrow screen. */}
        {active && (
          <div
            role="status"
            className="pointer-events-none absolute inset-x-0 top-[18%] mx-auto w-fit max-w-full rounded-control bg-ink px-3 py-2 text-left shadow-lg"
          >
            <p className="truncate text-sm font-medium text-white">
              {active.source}
            </p>
            <p className="mt-1 flex items-center gap-2 text-sm text-white">
              <span
                aria-hidden="true"
                className={cn("size-3 shrink-0 rounded-xs", active.swatch)}
              />
              Leads Count:{" "}
              <span className="font-semibold">
                {COUNT.format(active.total)}
              </span>
            </p>
          </div>
        )}
      </div>

      {/* Three columns on desktop as the reference draws it, collapsing to two and
          then one so a long source name never forces the card wider than its grid
          cell. `min-w-0` + truncate is what keeps that promise. */}
      <ul className="grid w-full grid-cols-1 gap-x-4 gap-y-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {arcs.map((arc) => (
          <li
            key={arc.source}
            className="flex min-w-0 items-center gap-2 text-sm text-ink-soft"
          >
            <span
              aria-hidden="true"
              className={cn("size-3 shrink-0 rounded-xs", arc.swatch)}
            />
            <span className="truncate" title={arc.source}>
              {arc.source}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
