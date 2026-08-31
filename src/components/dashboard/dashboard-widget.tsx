"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { WidgetPeriodFilter } from "./widget-period-filter";
import {
  periodKey,
  resolvePeriodRange,
  type DashboardPeriodId,
  type PeriodRange,
} from "@/lib/dashboard-period";

/**
 * A widget's period, owned by the widget (DASH-01.2).
 *
 * This hook is the whole mechanism: because the state is created *per call*, two
 * widgets can never share it, and there is no page-level date to accidentally
 * couple them through. Changing one widget's period cannot change another's
 * (AC2), and two widgets can sit at different periods at once (AC3).
 */
export function useWidgetPeriod(defaultPeriod: DashboardPeriodId) {
  const [period, setPeriod] = useState<DashboardPeriodId>(defaultPeriod);
  const range = useMemo(() => resolvePeriodRange(period), [period]);
  return { period, setPeriod, range, key: periodKey(period, range) };
}

type DashboardWidgetProps<T> = {
  title: string;
  /** This widget's own starting period (DASH-01.2 AC5 — sensible per widget). */
  defaultPeriod?: DashboardPeriodId;
  /** Omit to render a widget with no date filter of its own. */
  filterable?: boolean;
  /**
   * Loads this widget's data for its own period. Called again whenever *this*
   * widget's period changes — never when a sibling's does.
   */
  load: (range: PeriodRange, signal: AbortSignal) => Promise<T>;
  /** True when the load succeeded but there is nothing to show. */
  isEmpty?: (data: T) => boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  errorTitle?: string;
  /** Height the skeleton reserves, so the grid does not jump as widgets land. */
  skeletonClassName?: string;
  className?: string;
  children: (data: T) => React.ReactNode;
};

/**
 * The Dashboard's widget shell (DASH-01.1 AC5 + DASH-01.2).
 *
 * Every widget on the Dashboard is hosted by one of these, which is what makes the
 * two defining behaviours structural rather than a convention each widget has to
 * remember:
 *
 *   • **Independent state** — the period lives here, per instance, so there is no
 *     shared Dashboard date to couple widgets through.
 *   • **Independent loading** — each widget owns its own fetch, and renders its own
 *     loading / error / empty / ready state. One widget failing or hanging leaves
 *     every other widget on the page working.
 *
 * A result is tagged with the request it answers, so a slow earlier response can
 * never repaint a newer period — the same rule the Call Dashboard reads follow.
 */
export function DashboardWidget<T>({
  title,
  defaultPeriod = "all",
  filterable = true,
  load,
  isEmpty,
  emptyTitle = "No data available",
  emptyDescription = "There's currently no data to display here.",
  errorTitle = "Couldn’t load this widget",
  skeletonClassName = "h-40",
  className,
  children,
}: DashboardWidgetProps<T>) {
  const { period, setPeriod, range, key } = useWidgetPeriod(defaultPeriod);
  const [loaded, setLoaded] = useState<{ key: string; data: T } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  // The period is what identifies a request, so the fetch must not re-run just
  // because a parent re-rendered and handed us a new inline `load` closure. The
  // latest-ref pattern keeps the fetch effect keyed on the period alone while still
  // calling the current function — rather than silencing the dependency rule. The
  // ref is written in an effect, never during render, and this effect is declared
  // first so it has already run by the time the fetch below reads it.
  const loadRef = useRef(load);
  useEffect(() => {
    loadRef.current = load;
  });

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    loadRef
      .current(range, controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ key, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailed(key);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, reloadToken]);

  const data = loaded?.key === key ? loaded.data : null;
  const isError = failed === key;

  return (
    <Card as="section" className={className}>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h3 className="text-base font-semibold text-ink">{title}</h3>
        {filterable && (
          <WidgetPeriodFilter
            value={period}
            onChange={setPeriod}
            clearTo={defaultPeriod}
            label={`${title} period`}
          />
        )}
      </div>

      {isError ? (
        <div className="p-4">
          <ErrorState
            title={errorTitle}
            description="Something went wrong loading this widget. Check your connection and try again."
            onRetry={() => {
              setFailed(null);
              setReloadToken((token) => token + 1);
            }}
          />
        </div>
      ) : !data ? (
        <div className="p-4">
          <Skeleton className={`w-full rounded-surface ${skeletonClassName}`} />
        </div>
      ) : isEmpty?.(data) ? (
        <EmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        children(data)
      )}
    </Card>
  );
}
