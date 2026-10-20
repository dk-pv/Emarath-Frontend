/**
 * Logistics Dashboard v1: the rules that keep each number on the dashboard equal to the List it
 * opens. Every count comes from the API under the screen's own filters — the status, area and city
 * counts from `GET /logistics/orders/summary`, the delivery tiles and days from
 * `/delivery-schedule`, which ignores the Delivery Date filter so every bucket stays in view — and
 * opening one keeps those filters and adds exactly the narrowing it counted.
 *
 * Import-free apart from its sibling module, so its self-check compiles with plain tsc.
 */
import {
  scheduleFilters,
  type DeliveryBucket,
  type DeliveryChoice,
  type LogisticsFilters,
  type LogisticsOrdersQuery,
  type LogisticsStatus,
  type LogisticsUrlState,
  type RegionCount,
} from "./logistics-orders";

/** Upcoming deliveries: everything due today or later — the Today, Tomorrow and Future buckets. */
export const UPCOMING_BUCKETS: readonly DeliveryBucket[] = [
  "today",
  "tomorrow",
  "future",
];

/** How many upcoming orders the dashboard lists before "View all". */
export const UPCOMING_SIZE = 10;

/**
 * The upcoming list's request: every filter of the screen but the Delivery Date's own — like the
 * schedule — with the upcoming buckets instead, soonest first. Its total is the Today, Tomorrow
 * and Future tiles added up.
 */
export function upcomingQuery(filters: LogisticsFilters): LogisticsOrdersQuery {
  return {
    ...scheduleFilters(filters),
    delivery: UPCOMING_BUCKETS,
    page: 1,
    size: UPCOMING_SIZE,
    sort: "deliveryDate",
    direction: "asc",
  };
}

/** The three region fields the dashboard breaks the orders down by, each a filter of its own. */
export type AreaField = "state" | "city" | "country";

/** A number on the dashboard someone opened, and what it counted. */
export type DashboardDrill =
  | { kind: "status"; status: LogisticsStatus }
  | { kind: "delivery"; choice: DeliveryChoice }
  | { kind: "area"; field: AreaField; value: string }
  | { kind: "upcoming" };

/**
 * The List that shows exactly what a number counted: the screen's filters as they are, with the
 * number's own narrowing in place of that filter's value, from the first page.
 * - a status card replaces the Status filter with its status (a card the filter leaves out shows
 *   "—" and opens nothing);
 * - a delivery tile or day replaces the Delivery Date filter, as the schedule's tiles always have;
 * - an area, city or country row replaces that filter with its value;
 * - "View all" upcoming chooses the three upcoming buckets, soonest first.
 */
export function drillTo(drill: DashboardDrill): Partial<LogisticsUrlState> {
  const list = { view: "list" as const, page: 1, order: null };
  switch (drill.kind) {
    case "status":
      return { ...list, status: [drill.status] };
    case "delivery":
      return { ...list, ...drill.choice };
    case "area":
      return { ...list, [drill.field]: [drill.value] };
    case "upcoming":
      return {
        ...list,
        delivery: [...UPCOMING_BUCKETS],
        deliveryOn: null,
        sort: "deliveryDate",
        direction: "asc",
      };
  }
}

/** A row's bar, as a share of the largest row: 0–100, and 0 when every row is zero. */
export function barWidth(count: number, rows: readonly RegionCount[]): number {
  const max = Math.max(0, ...rows.map((row) => row.count));
  return max > 0 ? Math.round((count / max) * 100) : 0;
}

/** `42%` of the total, rounded; `0%` when there is no total. */
export function shareOf(count: number, total: number): string {
  return `${total > 0 ? Math.round((count / total) * 100) : 0}%`;
}

/**
 * Nothing to show at all: no order under the filters, and none in any delivery bucket under the
 * filters the schedule reads. A past delivery that already has an outcome is in no bucket, so the
 * total alone can still be above zero when every bucket is empty.
 */
export function isDashboardEmpty(
  total: number,
  buckets: Readonly<Record<DeliveryBucket, number>>,
): boolean {
  return total === 0 && Object.values(buckets).every((count) => count === 0);
}
