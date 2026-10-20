/**
 * Self-check for Logistics Dashboard v1's rules. No test runner is configured, so this is a plain
 * assert script compiled with the repo's own TypeScript (the `format.check.ts` rule), run from the
 * repository root:
 *
 *     npx tsc src/lib/logistics-dashboard.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/logistics-dashboard.check.js
 */
import assert from "node:assert/strict";
import {
  UPCOMING_BUCKETS,
  UPCOMING_SIZE,
  barWidth,
  drillTo,
  isDashboardEmpty,
  shareOf,
  upcomingQuery,
} from "./logistics-dashboard";
import {
  bucketChoice,
  dayChoice,
  logisticsOrdersParams,
  logisticsUrlParams,
  parseLogisticsUrl,
  type BusinessDay,
  type LogisticsFilters,
} from "./logistics-orders";

const LIMITS = {
  pageSizes: [10, 25, 50, 100],
  defaultSize: 100,
  searchMax: 200,
};
const day: BusinessDay = {
  timeZone: "Asia/Dubai",
  today: "2026-10-20",
  tomorrow: "2026-10-21",
};

// The Dashboard is a view of the screen's address, beside List and Pipeline; anything else is List.
assert.equal(
  parseLogisticsUrl(new URLSearchParams("view=dashboard"), LIMITS).view,
  "dashboard",
);
assert.equal(
  parseLogisticsUrl(new URLSearchParams("view=board"), LIMITS).view,
  "list",
);

// The upcoming list keeps every filter but the Delivery Date's own, soonest first.
const filters: LogisticsFilters = {
  status: ["QC_VERIFIED"],
  delivery: ["overdue"],
  deliveryOn: "2026-11-02",
  state: ["Dubai"],
  courier: ["Aramex"],
  assignedAgent: ["00000000-0000-4000-8000-000000000001"],
  search: "Acme",
};
assert.equal(
  logisticsOrdersParams(upcomingQuery(filters)).toString(),
  "page=1&size=10&status=QC_VERIFIED&delivery=today&delivery=tomorrow&delivery=future&state=Dubai&courier=Aramex&assignedAgent=00000000-0000-4000-8000-000000000001&search=Acme&sort=deliveryDate&direction=asc",
);
assert.equal(UPCOMING_SIZE, 10);
assert.deepEqual(UPCOMING_BUCKETS, ["today", "tomorrow", "future"]);

// Opening a number keeps the screen's other filters and replaces only its own, on the List, page 1.
const current = parseLogisticsUrl(
  new URLSearchParams(
    "view=dashboard&status=INITIAL&status=DISPATCHED&delivery=overdue&city=Deira&state=Dubai&state=Sharjah&page=3&order=00000000-0000-4000-8000-0000000000aa",
  ),
  LIMITS,
);
const open = (changes: ReturnType<typeof drillTo>) =>
  logisticsUrlParams({ ...current, ...changes }, LIMITS.defaultSize).toString();
assert.equal(
  open(drillTo({ kind: "status", status: "DISPATCHED" })),
  "status=DISPATCHED&delivery=overdue&city=Deira&state=Dubai&state=Sharjah",
);
assert.equal(
  open(drillTo({ kind: "delivery", choice: bucketChoice("tomorrow") })),
  "status=INITIAL&status=DISPATCHED&delivery=tomorrow&city=Deira&state=Dubai&state=Sharjah",
);
// A day beyond tomorrow is that day alone; today and tomorrow stay buckets.
assert.equal(
  open(drillTo({ kind: "delivery", choice: dayChoice("2026-10-25", day) })),
  "status=INITIAL&status=DISPATCHED&city=Deira&state=Dubai&state=Sharjah&deliveryOn=2026-10-25",
);
assert.equal(
  open(drillTo({ kind: "area", field: "state", value: "Sharjah" })),
  "status=INITIAL&status=DISPATCHED&delivery=overdue&city=Deira&state=Sharjah",
);
assert.equal(
  open(drillTo({ kind: "area", field: "country", value: "Oman" })),
  "status=INITIAL&status=DISPATCHED&delivery=overdue&country=Oman&city=Deira&state=Dubai&state=Sharjah",
);
assert.equal(
  open(drillTo({ kind: "upcoming" })),
  "status=INITIAL&status=DISPATCHED&delivery=today&delivery=tomorrow&delivery=future&city=Deira&state=Dubai&state=Sharjah&sort=deliveryDate&direction=asc",
);

// Bars are shares of the largest row; shares of the total are whole percents.
const rows = [
  { value: "Dubai", count: 8 },
  { value: "Sharjah", count: 2 },
  { value: null, count: 0 },
];
assert.equal(barWidth(8, rows), 100);
assert.equal(barWidth(2, rows), 25);
assert.equal(barWidth(0, [{ value: null, count: 0 }]), 0);
assert.equal(shareOf(2, 8), "25%");
assert.equal(shareOf(1, 3), "33%");
assert.equal(shareOf(0, 0), "0%");

// Empty only when no order matches and no bucket holds one.
const none = { today: 0, tomorrow: 0, future: 0, overdue: 0, none: 0 };
assert.equal(isDashboardEmpty(0, none), true);
assert.equal(isDashboardEmpty(0, { ...none, overdue: 1 }), false);
assert.equal(isDashboardEmpty(3, none), false);

console.log("logistics-dashboard.check: all assertions passed");
