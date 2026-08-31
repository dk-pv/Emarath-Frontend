"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/Card";
import { ErrorState } from "@/components/ui/ErrorState";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  fetchCallAnalytics,
  type CallAnalytics,
  type CallCountRow,
} from "@/services/calls-service";
import { resolveCallRange, type CallFilterState } from "./call-filter-panel";

const NUMBER = new Intl.NumberFormat("en-AE");

/**
 * The donut's slice colours. Written as literal Tailwind classes because the JIT
 * only emits utilities it can see in source, and taken from the same hue family
 * the Kanban stage palette uses so the dashboard reads as one product.
 *
 * It is a rotation, not a mapping: lead sources are free text with no catalogue
 * (the Leads By Source report makes the same call), so no colour claims to mean
 * a particular source. Slices past the eleventh reuse the cycle.
 */
const SLICE_STROKE = [
  "stroke-violet-500",
  "stroke-cyan-500",
  "stroke-amber-500",
  "stroke-emerald-500",
  "stroke-rose-400",
  "stroke-blue-600",
  "stroke-lime-500",
  "stroke-teal-400",
  "stroke-orange-500",
  "stroke-slate-500",
  "stroke-pink-400",
];

const SLICE_FILL = [
  "bg-violet-500",
  "bg-cyan-500",
  "bg-amber-500",
  "bg-emerald-500",
  "bg-rose-400",
  "bg-blue-600",
  "bg-lime-500",
  "bg-teal-400",
  "bg-orange-500",
  "bg-slate-500",
  "bg-pink-400",
];

/** A label/count list panel — Call By Status and Calls By Lead Stage share it. */
function CountPanel({
  title,
  rows,
  countHeader = "Count",
  emptyLabel,
}: {
  title: string;
  rows: CallCountRow[];
  countHeader?: string;
  emptyLabel: string;
}) {
  return (
    <Card as="section" className="flex min-w-0 flex-col">
      <div className="flex items-center justify-between gap-3 border-b border-hairline px-4 py-3">
        <h3 className="truncate text-sm font-semibold text-ink">{title}</h3>
        <span className="shrink-0 text-sm font-semibold text-ink">
          {countHeader}
        </span>
      </div>
      {rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          {emptyLabel}
        </p>
      ) : (
        // A definition list: assistive tech reads each label with its own count
        // instead of two disconnected columns.
        <dl className="max-h-72 divide-y divide-hairline overflow-y-auto">
          {rows.map((row) => (
            <div
              key={row.label}
              className="flex items-center justify-between gap-3 px-4 py-3"
            >
              <dt className="truncate text-sm text-ink" title={row.label}>
                {row.label}
              </dt>
              <dd className="shrink-0 text-sm tabular-nums text-ink">
                {NUMBER.format(row.count)}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </Card>
  );
}

const RADIUS = 56;
const STROKE = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

/**
 * The Call Summary By Lead Source donut. Dependency-free: one SVG circle per
 * slice, each drawn as a dash of its share of the circumference and offset past
 * the slices before it — the project has no charting library and this does not
 * justify adding one.
 *
 * The ring is `aria-hidden` and the figures are read from the legend beside it,
 * which is the accessible representation of the same numbers.
 */
function SourceDonut({ rows, total }: { rows: CallCountRow[]; total: number }) {
  // Geometry is derived up front, without a running accumulator: each slice is
  // offset past the total length of the slices before it. Quadratic in the number
  // of sources, which is a handful — a real accumulator would be a reassignment
  // the React Compiler rejects, for no measurable gain here.
  const slices = useMemo(() => {
    const lengths = rows.map((row) =>
      total ? (row.count / total) * CIRCUMFERENCE : 0,
    );
    return rows.map((row, index) => ({
      row,
      length: lengths[index],
      offset: -lengths.slice(0, index).reduce((sum, n) => sum + n, 0),
    }));
  }, [rows, total]);

  return (
    <div className="flex flex-wrap items-center justify-center gap-6 px-4 py-6">
      <div className="relative shrink-0">
        <svg
          viewBox="0 0 160 160"
          className="size-40"
          role="presentation"
          aria-hidden="true"
        >
          {/* The track keeps the ring a full circle when one slice is the whole total. */}
          <circle
            cx="80"
            cy="80"
            r={RADIUS}
            fill="none"
            strokeWidth={STROKE}
            className="stroke-canvas"
          />
          {slices.map(({ row, length, offset }, index) => {
            return (
              <circle
                key={row.label}
                cx="80"
                cy="80"
                r={RADIUS}
                fill="none"
                strokeWidth={STROKE}
                strokeDasharray={`${length} ${CIRCUMFERENCE - length}`}
                strokeDashoffset={offset}
                // -90° puts the first slice at twelve o'clock, as the reference draws it.
                transform="rotate(-90 80 80)"
                className={SLICE_STROKE[index % SLICE_STROKE.length]}
              />
            );
          })}
        </svg>
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm font-medium text-ink">
          Total {NUMBER.format(total)}
        </span>
      </div>

      <ul className="flex max-h-40 min-w-0 flex-col gap-2 overflow-y-auto">
        {rows.map((row, index) => (
          <li key={row.label} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`size-2.5 shrink-0 rounded-full ${SLICE_FILL[index % SLICE_FILL.length]}`}
            />
            <span className="truncate text-ink" title={row.label}>
              {row.label}
            </span>
            <span className="ml-auto shrink-0 tabular-nums text-ink-muted">
              {NUMBER.format(row.count)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {[0, 1, 2].map((n) => (
        <Skeleton key={n} className="h-64 rounded-surface" />
      ))}
    </div>
  );
}

/**
 * The three panels beneath the leaderboard: Call By Status, Call Summary By Lead
 * Source and Calls By Lead Stage. Every figure comes from `GET /calls/analytics`
 * over the same scoped window the KPI cards use, so the panels can never
 * contradict the cards above them.
 */
export function CallAnalyticsPanels({ filters }: { filters: CallFilterState }) {
  const range = useMemo(() => resolveCallRange(filters), [filters]);
  const requestKey = `${range.from}|${range.to}|${range.agentId ?? ""}`;

  const [loaded, setLoaded] = useState<{
    key: string;
    data: CallAnalytics;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallAnalytics(range, controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ key: requestKey, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailed(requestKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [range, requestKey, reloadToken]);

  const data = loaded?.key === requestKey ? loaded.data : null;

  if (failed === requestKey) {
    return (
      <ErrorState
        title="Couldn’t load call analytics"
        description="Something went wrong loading the call breakdowns. Check your connection and try again."
        onRetry={() => {
          setFailed(null);
          setReloadToken((token) => token + 1);
        }}
      />
    );
  }

  if (!data) return <AnalyticsSkeleton />;

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      <CountPanel
        title="Call By Status"
        rows={data.byStatus}
        emptyLabel="No calls in this period."
      />

      <Card as="section" className="flex min-w-0 flex-col">
        <SectionHeader title="Call Summary By Lead Source" />
        {data.bySource.length === 0 ? (
          <p className="px-4 py-8 text-center text-sm text-ink-muted">
            No calls in this period.
          </p>
        ) : (
          <SourceDonut rows={data.bySource} total={data.total} />
        )}
      </Card>

      <CountPanel
        title="Calls By Lead Stage"
        rows={data.byStage}
        emptyLabel="No calls in this period."
      />
    </div>
  );
}
