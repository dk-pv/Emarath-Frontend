import { dayBoundaries, windowEdges } from "@/lib/day-boundaries";

/**
 * The period a single Dashboard widget is showing (DASH-01.2).
 *
 * Deliberately NOT a page-level value: the Dashboard's defining behaviour is that
 * each widget carries its own filter, so two widgets can show different periods at
 * the same time (DASH-01.2 AC1–AC3). Nothing here is shared state — this module is
 * pure resolution, and the state itself lives inside each widget.
 */
export type DashboardPeriodId =
  "all" | "today" | "yesterday" | "this-week" | "this-month";

/**
 * The presets a widget's filter offers.
 *
 * The Workpex Dashboard's own dropdown is **not captured** in any reference
 * screenshot (registered gap D-01) — only the applied chips are, showing
 * "This Month" on the KPI row and "Yesterday" on the Alerts widget. Rather than
 * invent a list, this reuses the set from the one Workpex period filter that *is*
 * captured — the Call Dashboard's Filters popup — which contains both observed
 * values. Replace this list, not the mechanism, once D-01 is captured.
 */
export const DASHBOARD_PERIODS: { id: DashboardPeriodId; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "this-week", label: "This Week" },
  { id: "this-month", label: "This Month" },
];

/**
 * A resolved window as the APIs take it: ISO instants, `to` exclusive. Both bounds
 * are absent for "All", which means "no date predicate" — a widget that cannot
 * answer unbounded is responsible for saying so, rather than this inventing a cap.
 */
export type PeriodRange = { from?: string; to?: string };

export function periodLabel(id: DashboardPeriodId): string {
  return DASHBOARD_PERIODS.find((p) => p.id === id)?.label ?? "All";
}

/**
 * The `[from, to)` window for a preset, in the **user's own timezone**.
 *
 * Built on the existing `dayBoundaries`/`windowEdges` helpers rather than a second
 * copy of the same arithmetic, so "today" and "this week" resolve to exactly the
 * instants the Activities worklist and the Leads quick filters already use
 * (ADR-0028 §3). Weeks start on Monday, as they do everywhere else in the product.
 */
export function resolvePeriodRange(id: DashboardPeriodId): PeriodRange {
  if (id === "all") return {};

  const days = dayBoundaries();
  const edges = windowEdges();

  switch (id) {
    case "today":
      return { from: days.todayStart, to: days.todayEnd };
    case "yesterday":
      return { from: edges.yesterdayStart, to: days.todayStart };
    case "this-week":
      return { from: edges.weekStart, to: edges.weekEnd };
    case "this-month":
      return { from: edges.monthStart, to: edges.monthEnd };
  }
}

/** A stable key for a resolved range — what a widget tags its in-flight request with. */
export function periodKey(id: DashboardPeriodId, range: PeriodRange): string {
  return `${id}|${range.from ?? ""}|${range.to ?? ""}`;
}
