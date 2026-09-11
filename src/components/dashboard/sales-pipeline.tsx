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
import { WidgetPeriodFilter } from "./widget-period-filter";

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

/**
 * Sales Pipeline Overview (DASH-12.2).
 *
 * One horizontal bar per stage, scaled against the busiest stage so the longest bar
 * fills its track and the rest read as a share of it. The stages, their order and
 * their counts all come from the API — the configured `position` order and the
 * Kanban board's own rollup — so nothing about the pipeline's shape is decided here.
 *
 * The widget owns its own period (DASH-01.2), so changing it here cannot touch a
 * sibling widget.
 */
export function SalesPipeline() {
  const { period, setPeriod, range } = useWidgetPeriod("this-month");
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
    <Card as="section" className="flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold text-ink">Sales Pipeline</h2>
        <WidgetPeriodFilter
          value={period}
          onChange={setPeriod}
          clearTo="this-month"
          label="Sales Pipeline period"
        />
      </div>

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
                // The count reaches assistive tech and the native tooltip; the
                // reference shows it on hover only.
                title={`${stage.label}: ${COUNT.format(stage.count)}`}
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
    </Card>
  );
}
