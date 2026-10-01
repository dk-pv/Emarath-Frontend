"use client";

import { useEffect, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { isAbortError } from "@/lib/api-client";
import { periodKey } from "@/lib/dashboard-period";
import {
  fetchSalesPipeline,
  type SalesPipelineOverview as Overview,
} from "@/services/dashboard-service";
import { useWidgetPeriod } from "./dashboard-widget";

const COUNT = new Intl.NumberFormat("en-US");

/**
 * Row geometry, measured off
 * dashboard-sidebar-collapsed-leads-vs-conversion-sales-team-toggle.png at 1:1 and
 * taken to the product's density (ADR-0076, × 0.9):
 *
 *   bar height 19 → 17 · label column 181 → 163 · single-line row pitch 55 → 50
 *
 * The label column is fixed so every track starts at the same x even where a name
 * wraps to two lines, which the reference does for DATE SHIPMENT(LP) and NOT
 * REACHEBLE(LP).
 */
const LABEL_COL = "w-[163px] min-w-[163px]";
const BAR_H = "h-[17px]";

/**
 * The cap before the list scrolls. A 17px bar on a `gap-8` (32px) column gives the
 * reference's measured 50px row pitch, so this is nine rows — the number the
 * capture shows.
 *
 * Fixed, deliberately. Letting it stretch to the card with `flex-1` was tried and
 * reverted: the grid row is `auto`, so the row takes its height from content and an
 * uncapped list simply grew the row — and the page with it, which is the one thing
 * this cap exists to prevent.
 */
const LIST_HEIGHT = "max-h-[441px]";

/** Half the tooltip's width — the most its centre may come to a card edge. */
const TIP_HALF = 90;

type Hover = { label: string; count: number; x: number; y: number } | null;

/**
 * Sales Pipeline Overview (DASH-12.2).
 *
 * One horizontal bar per stage, scaled against the busiest stage so the longest bar
 * fills its track and the rest read as a share of it. The stages, their order and
 * their counts all come from the API — the configured `position` order and the
 * Kanban board's own rollup — so nothing about the pipeline's shape is decided here.
 *
 * Hovering a bar shows the reference's tooltip — the stage, then its lead count —
 * over the bar, where the cursor is.
 */
export function SalesPipeline() {
  /**
   * The period is kept but no longer exposed: neither reference draws a date
   * control on this widget, so the chip is gone — as it already is on Leads vs
   * Conversion beside it — and the widget stays on its established default.
   */
  const { period, range } = useWidgetPeriod("this-month");
  const [hover, setHover] = useState<Hover>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const [loaded, setLoaded] = useState<{ key: string; data: Overview } | null>(
    null,
  );
  const [failed, setFailed] = useState<string | null>(null);
  const list = useRef<HTMLDivElement>(null);

  const key = periodKey(period, range);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchSalesPipeline(range, controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ key, data });
        // A new answer starts at the top: leaving the reader halfway down the
        // previous period's stage list is disorienting (DASH-12.2).
        list.current?.scrollTo({ top: 0 });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone.
        console.error("Sales Pipeline failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, reloadToken]);

  const current = loaded?.key === key ? loaded.data : null;
  const isError = failed === key;

  const stages = current?.stages ?? [];
  // The busiest stage defines a full track; everything else is a share of it. Never
  // a fixed width, and a zero-count stage draws nothing rather than a stub that
  // would read as "a few".
  const max = stages.reduce((top, stage) => Math.max(top, stage.count), 0);

  return (
    <Card as="section" className="relative flex flex-col gap-4 p-5">
      <h2 className="text-xl font-semibold text-ink">Sales Pipeline</h2>

      {isError ? (
        <ErrorState
          title="Couldn’t load the Sales Pipeline"
          description="Something went wrong loading this widget. Check your connection and try again."
          onRetry={() => {
            setFailed(null);
            setReloadToken((token) => token + 1);
          }}
        />
      ) : current === null ? (
        // A skeleton at the list's own height, so a period change never shifts the
        // page and stale bars are never shown as the new answer.
        <Skeleton className="h-[441px] w-full rounded-surface" />
      ) : stages.length === 0 ? (
        <div className="flex min-h-112.5 items-center justify-center">
          <EmptyState
            title="No pipeline stages"
            description="No stages are set to appear in the Sales Pipeline."
          />
        </div>
      ) : (
        /*
         * Capped and scrolled **inside** the card: a pipeline with thirty stages
         * must not stretch the Dashboard. The scrollbar is visible, as the
         * reference draws it on the right of the rows.
         */
        <div
          ref={list}
          role="region"
          aria-label="Sales pipeline stages"
          tabIndex={0}
          onScroll={() => setHover(null)}
          className={`focus-ring scrollbar-slim flex flex-col gap-8 overflow-y-auto pr-1 ${LIST_HEIGHT}`}
        >
          {stages.map((stage) => (
            <div key={`${stage.pipeline}/${stage.name}`} className="flex gap-4">
              {/* Wraps to two lines rather than truncating: a stage name is the
                  only thing identifying its row, and the reference wraps too. */}
              <span
                className={`${LABEL_COL} self-center text-sm text-ink-soft`}
              >
                {stage.label}
              </span>
              <span
                className={`relative flex-1 self-center overflow-hidden rounded-full bg-pipeline-track ${BAR_H}`}
                // The count reaches assistive tech here; the reference shows it
                // to the pointer only, in the tooltip below.
                onMouseMove={(event) => {
                  const card = event.currentTarget
                    .closest("section")
                    ?.getBoundingClientRect();
                  if (!card) return;
                  const bar = event.currentTarget.getBoundingClientRect();
                  setHover({
                    label: stage.label,
                    count: stage.count,
                    x: Math.min(
                      Math.max(event.clientX - card.left, TIP_HALF),
                      card.width - TIP_HALF,
                    ),
                    y: bar.top - card.top,
                  });
                }}
                onMouseLeave={() => setHover(null)}
                role="img"
                aria-label={`${stage.label}, lead count ${COUNT.format(stage.count)}`}
              >
                {stage.count > 0 && (
                  <span
                    className={`absolute inset-y-0 left-0 rounded-full bg-pipeline-bar`}
                    style={{
                      width: `${max > 0 ? Math.max((stage.count / max) * 100, 2) : 0}%`,
                    }}
                  />
                )}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* The reference's tooltip (sidebar-collapsed capture): heading ink, the
          stage in bold, a dot in the bar's colour, then the count. Its foot sits
          11px into the hovered bar, as the reference's 12 does at 1:1. */}
      {hover && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-control bg-ink px-3 py-2 whitespace-nowrap shadow-lg"
          style={{ left: hover.x, top: hover.y + 11 }}
        >
          <p className="text-sm font-semibold text-white">{hover.label}</p>
          <p className="mt-1 flex items-center gap-2 text-sm text-white">
            <span
              aria-hidden="true"
              className="size-3 shrink-0 rounded-full bg-pipeline-bar"
            />
            <span>
              Lead count:{" "}
              <span className="font-semibold">{COUNT.format(hover.count)}</span>
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}
