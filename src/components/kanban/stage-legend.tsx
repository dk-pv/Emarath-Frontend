"use client";

import { useEffect, useMemo, useState } from "react";
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
 * (`kanban-board-default-legend-tooltip-converted.png`). One contiguous segment per
 * stage that holds leads, its width proportional to the stage's lead count and its
 * colour the stage's own colour; hovering a segment shows "name | count".
 *
 * Driven live by the two API sources, no third copy: colours + order from the stage
 * catalogue (`useStages`), counts from the board summary (`GET /leads/board`, the same
 * figures the columns show). Measured at ~180×32px, rounded, segments touching, the
 * dark app tooltip with a caret.
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

  // The view this legend is showing: pipeline + the filter that shaped it (+ a New
  // Lead refresh). A change makes the bar read as "loading" until its fetch lands.
  const key = useMemo(
    () =>
      JSON.stringify({
        pipeline,
        search: query.search ?? "",
        conditions: query.conditions,
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
      <div className="h-8 w-[180px] shrink-0 animate-pulse rounded-control bg-canvas" />
    );
  }

  const countByStage = new Map(summary.stages.map((s) => [s.stage, s.count]));
  const segments = stages
    .map((stage) => ({
      name: stage.name,
      color: stage.color,
      count: countByStage.get(stage.name) ?? 0,
    }))
    .filter((segment) => segment.count > 0);
  const total = segments.reduce((sum, segment) => sum + segment.count, 0);

  if (total === 0) {
    return (
      <div className="flex h-8 w-[180px] shrink-0 items-center justify-center rounded-control border border-hairline bg-canvas text-xs text-ink-subtle">
        No leads
      </div>
    );
  }

  return (
    <div
      role="img"
      aria-label="Stage distribution by lead count"
      className="flex h-8 w-[180px] shrink-0 overflow-hidden rounded-control border border-hairline bg-canvas"
    >
      {segments.map((segment) => (
        <div
          key={segment.name}
          className="group relative h-full"
          style={{ width: `${(segment.count / total) * 100}%` }}
        >
          <div
            className={cn("h-full w-full", stageColorClasses(segment.color).swatch)}
          />
          <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-50 hidden -translate-x-1/2 flex-col items-center group-hover:flex">
            <span className="w-max rounded-control bg-sidebar px-2.5 py-1.5 text-xs text-white shadow-lg">
              {segment.name} | {segment.count}
            </span>
            <span className="-mt-1 size-2 rotate-45 bg-sidebar" aria-hidden="true" />
          </div>
        </div>
      ))}
    </div>
  );
}
