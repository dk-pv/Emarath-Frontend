/**
 * Self-check for Financial Dashboard v1's definitions and helpers. No test runner is configured,
 * so this is a plain assert script compiled with the repo's own TypeScript (the `format.check.ts`
 * rule), run from the repository root:
 *
 *     npx tsc src/lib/financial-dashboard.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/financial-dashboard.check.js
 */
import assert from "node:assert/strict";
import {
  FINANCIAL_DATE_FIELDS,
  FINANCIAL_METRICS,
  OUTCOME_METRIC,
  OUTCOME_STATUSES,
  UNAVAILABLE_METRICS,
  shareOfOrders,
  statusFigures,
  statusRows,
  unvaluedOrders,
} from "./financial-dashboard";
import { LOGISTICS_STATUSES } from "./logistics-orders";
import {
  teamPerformanceParams,
  type TeamPerformanceFigures,
} from "./team-performance";

// No figure on the screen is named as money in hand, and the two values say they are not.
const MONEY_IN = /payment|paid|receiv|collect|outstanding|profit|cost|margin/i;
for (const [key, metric] of Object.entries(FINANCIAL_METRICS)) {
  assert.doesNotMatch(metric.label, MONEY_IN, key);
  assert.ok(metric.definition.length > 20, `${key} has a definition`);
}
assert.match(FINANCIAL_METRICS.wonValue.definition, /not money received/);
assert.match(FINANCIAL_METRICS.orderValue.definition, /not money received/);
assert.match(FINANCIAL_METRICS.delivered.definition, /Delivered is not paid/);
for (const status of OUTCOME_STATUSES) {
  assert.ok(FINANCIAL_METRICS[OUTCOME_METRIC[status]]);
}

// What the specification asks for that the data cannot support: each named with what it waits
// for, and none carrying a figure.
assert.deepEqual(
  UNAVAILABLE_METRICS.map((metric) => metric.label),
  [
    "Payment received",
    "Payment pending",
    "Outstanding amount",
    "Collection %",
    "Logistics and shipping cost",
    "Product cost",
    "Estimated profitability",
  ],
);
for (const metric of UNAVAILABLE_METRICS) {
  assert.deepEqual(Object.keys(metric).sort(), ["label", "needs"]);
  assert.ok(metric.needs.length > 20, `${metric.label} names its dependency`);
}
assert.deepEqual([...OUTCOME_STATUSES], ["DELIVERED", "CANCELLED", "RTO"]);

// Shares of the orders, to two places; none of nothing.
assert.equal(shareOfOrders(2, 5), 40);
assert.equal(shareOfOrders(1, 3), 33.33);
assert.equal(shareOfOrders(0, 0), 0);
assert.equal(shareOfOrders(5, 5), 100);

const figures: TeamPerformanceFigures = {
  leads: 9,
  won: 4,
  orders: 5,
  conversionRate: 44.44,
  wonValue: "6000",
  wonUnvalued: 1,
  orderValue: "5300",
  orderStatus: [
    { status: "DISPATCHED", orders: 1, value: "2000", unvalued: 0 },
    { status: "DELIVERED", orders: 2, value: "2500", unvalued: 0 },
    { status: "CANCELLED", orders: 1, value: "0", unvalued: 1 },
    { status: "RTO", orders: 1, value: "800", unvalued: 0 },
  ],
};

// A status the row does not carry reads as zero, never missing.
assert.deepEqual(statusFigures(figures, "INITIAL"), {
  status: "INITIAL",
  orders: 0,
  value: "0",
  unvalued: 0,
});
assert.equal(statusFigures(figures, "DELIVERED").value, "2500");

// The table: every status in pipeline order, labelled as the Logistics screen labels them.
const rows = statusRows(figures);
assert.deepEqual(
  rows.map((row) => row.status),
  [...LOGISTICS_STATUSES],
);
assert.equal(rows[0].label, "QC Pending");
assert.deepEqual(
  rows.map((row) => row.share),
  [0, 0, 0, 20, 40, 20, 20],
);
assert.equal(
  rows.reduce((sum, row) => sum + row.orders, 0),
  figures.orders,
);
assert.equal(unvaluedOrders(figures), 1);

// The order-created window is offered, and sent as any other date field.
assert.deepEqual(
  FINANCIAL_DATE_FIELDS.map((field) => field.value),
  ["created", "statusChanged", "orderCreated"],
);
assert.equal(
  teamPerformanceParams({
    from: "2026-10-01T00:00:00.000Z",
    dateField: "orderCreated",
    team: ["Alpha"],
    agent: [],
    source: [],
    manager: null,
  }).toString(),
  "from=2026-10-01T00%3A00%3A00.000Z&dateField=orderCreated&team=Alpha",
);

console.log("financial-dashboard.check: all assertions passed");
