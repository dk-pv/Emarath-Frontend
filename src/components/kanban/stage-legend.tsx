"use client";

import { useEffect, useState } from "react";
import { useStages } from "@/components/stages/stages-context";
import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
import {
  fetchBoard,
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
 */
export function StageLegend({ pipeline }: { pipeline: string }) {
  const { stages } = useStages();
  const [loaded, setLoaded] = useState<{
    pipeline: string;
    summary: LeadBoardResponse;
  } | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchBoard(pipeline, controller.signal)
      .then((summary) => setLoaded({ pipeline, summary }))
      .catch(() => {
        // A legend miss leaves the placeholder; the board surfaces the real error.
      });
    return () => controller.abort();
  }, [pipeline]);

  // Derived, not sequenced (no setState in the effect): a summary for a different
  // pipeline reads as "loading" until the current one arrives.
  const summary = loaded?.pipeline === pipeline ? loaded.summary : null;

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
