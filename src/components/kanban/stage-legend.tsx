"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchBoard,
  type BoardFilterQuery,
  type LeadBoardResponse,
} from "@/services/leads-board-service";

/**
 * The stage colour legend (KAN-06.1 AC3) — the horizontal bar on the board header
 * (`kanban-board-default-legend-tooltip-converted.png`). One segment per configured
 * stage — including zero-count ones — its width proportional to the stage's lead
 * count (with a minimum so every segment stays visible and hoverable) and its colour
 * the stage's own colour; hovering a segment shows a dark "name | count" tooltip.
 *
 * Driven live by the two API sources, no third copy: colours + order from the stage
 * catalogue (`useStages`), counts from the board summary (`GET /leads/board`, the same
 * figures the columns show). Measured at ~168×32px (the colour bar in the reference
 * spans ~168px), rounded, segments touching, the dark app tooltip with a caret.
 *
 * The counts follow the board toolbar's search + filters (KAN-07.1): the same `query`
 * the board loads with is passed here, so the legend's proportions narrow with the
 * cards. It keys only on search + filters, never sort — sort reorders cards without
 * changing a stage's count, so the legend must not move for it. `reloadKey` lets a
 * New Lead refresh the bar.
 */
export function StageLegend({
  pipeline,
  query,
  reloadKey = 0,
}: {
  pipeline: string;
  query: BoardFilterQuery;
  reloadKey?: number;
}) {
  const { stages } = useStages();
  const [loaded, setLoaded] = useState<{
    key: string;
    summary: LeadBoardResponse;
  } | null>(null);
  // The hovered segment's identity + its centre x within the bar, driving the one
  // tooltip rendered in the non-clipped wrapper below. Entering another segment
  // replaces it; leaving a segment clears it — so no stale tooltip lingers.
  const [hovered, setHovered] = useState<{
    name: string;
    count: number;
    x: number;
    y: number;
  } | null>(null);

  // The view this legend is showing: pipeline + the filter that shaped it (+ a New
  // Lead refresh). A change makes the bar read as "loading" until its fetch lands.
  const key = useMemo(
    () =>
      JSON.stringify({
        pipeline,
        search: query.search ?? "",
        conditions: query.conditions,
        // Without this the bar would keep its old proportions when only the advanced
        // filter changed — the legend must narrow with the cards (KAN-07.1 AC5).
        advancedConditions: query.advancedConditions ?? "",
        reloadKey,
      }),
    [pipeline, query, reloadKey],
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchBoard(pipeline, query, controller.signal)
      .then((summary) => setLoaded({ key, summary }))
      .catch(() => {
        // A legend miss leaves the placeholder; the board surfaces the real error.
      });
    return () => controller.abort();
  }, [pipeline, query, key]);

  // Derived, not sequenced (no setState in the effect): a summary for a different
  // view reads as "loading" until the current one arrives.
  const summary = loaded?.key === key ? loaded.summary : null;

  if (summary === null) {
    return (
      <div className="h-8 w-[172px] shrink-0 animate-pulse rounded-control bg-canvas" />
    );
  }

  const countByStage = new Map(summary.stages.map((s) => [s.stage, s.count]));
  // Every configured stage is a segment, including zero-count ones (Workpex shows
  // them too, e.g. "NOT APPROVED - WON | 0"). Widths are proportional to the count
  // (flex-grow), but each keeps a minimum width so a 0- or 1-lead stage stays
  // visible and hoverable rather than collapsing to a sub-pixel sliver.
  const segments = stages.map((stage) => ({
    name: stage.name,
    color: stage.color,
    count: countByStage.get(stage.name) ?? 0,
  }));
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-8 w-[172px] shrink-0 items-center justify-center rounded-control border border-hairline bg-canvas text-xs text-ink-subtle">
        No leads
      </div>
    );
  }

  return (
    <>
      <div
        role="img"
        aria-label="Stage distribution by lead count"
        className="flex h-8 w-[172px] shrink-0 overflow-hidden rounded-control border border-hairline bg-canvas"
      >
        {segments.map((segment) => (
          <div
            key={segment.name}
            className="h-full min-w-[6px] cursor-default"
            style={{ flexGrow: segment.count, flexShrink: 0, flexBasis: 0 }}
            onMouseEnter={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              setHovered({
                name: segment.name,
                count: segment.count,
                x: rect.left + rect.width / 2,
                y: rect.top,
              });
            }}
            onMouseLeave={() => setHovered(null)}
          >
            <div
              className={cn(
                "h-full w-full",
                stageColorClasses(segment.color).swatch,
              )}
            />
          </div>
        ))}
      </div>
      {/* Portalled to <body> so the Content region's `overflow-auto` can't clip it:
          the legend sits near the top, so the tooltip rises into the navbar's band.
          Positioned `fixed` off the hovered segment's viewport rect, centred over it
          and lifted fully above it — a downward caret points back at the segment. */}
      {hovered &&
        createPortal(
          <div
            className="pointer-events-none fixed z-[200] flex -translate-x-1/2 -translate-y-full flex-col items-center"
            style={{ left: hovered.x, top: hovered.y - 6 }}
          >
            <span className="w-max rounded-control bg-neutral-900 px-2.5 py-1 text-xs font-medium text-white shadow-sm">
              {hovered.name} | {hovered.count}
            </span>
            <span
              className="-mt-1 size-2 rotate-45 bg-neutral-900"
              aria-hidden="true"
            />
          </div>,
          document.body,
        )}
    </>
  );
}
