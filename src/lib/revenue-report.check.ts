/**
 * Self-check for the Revenue Report's windows and drawing rules. No test runner is configured, so
 * this is a plain assert script compiled with the repo's own TypeScript (the `format.check.ts`
 * rule), run from the repository root:
 *
 *     npx tsc src/lib/revenue-report.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/revenue-report.check.js
 *
 * Dates are built with the local-time constructor, so it holds in any timezone. The figures are
 * the server's (`revenue-report.spec.ts`, `revenue.service.spec.ts`).
 */
import assert from "node:assert/strict";
import {
  comparisonLabel,
  formatRate,
  niceScale,
  priorWindow,
  revenuePeriodLabel,
  revenueSubtitle,
  targetTitle,
  trendBuckets,
  wholeMonths,
  type PeriodRange,
} from "./revenue-report";

const local = (y: number, m: number, d = 1, h = 0) =>
  new Date(y, m - 1, d, h).toISOString();
const Q4 = { from: local(2026, 10), to: local(2027, 1) };

// The header's period names — the capture's "Q4 2026 · All agents · All pipelines".
assert.equal(revenuePeriodLabel("thisQuarter", Q4), "Q4 2026");
assert.equal(
  revenuePeriodLabel("lastMonth", {
    from: local(2026, 9),
    to: local(2026, 10),
  }),
  "Sep 2026",
);
assert.equal(
  revenuePeriodLabel("thisFinancialYear", {
    from: local(2026, 1),
    to: local(2027, 1),
  }),
  "FY 2026",
);
assert.equal(
  revenuePeriodLabel("today", {
    from: local(2026, 10, 27),
    to: local(2026, 10, 28),
  }),
  "27 Oct 2026",
);
assert.equal(
  revenuePeriodLabel("last7Days", {
    from: local(2026, 10, 21),
    to: local(2026, 10, 28),
  }),
  "21 Oct – 27 Oct 2026",
);
assert.equal(
  revenuePeriodLabel("custom", {
    from: local(2025, 12, 28),
    to: local(2026, 1, 4),
  }),
  "28 Dec 2025 – 3 Jan 2026",
);
assert.equal(revenuePeriodLabel(null, {}), "All time");
assert.equal(
  revenueSubtitle("Q4 2026", undefined, null),
  "Q4 2026 · All agents · All pipelines",
);
assert.equal(
  revenueSubtitle("Q4 2026", "NIHAD V P", "Lead Pipeline"),
  "Q4 2026 · NIHAD V P · Lead Pipeline",
);

// Whole calendar months: the multiple of the monthly goals; none for a part month.
assert.equal(wholeMonths(Q4), 3);
assert.equal(wholeMonths({ from: local(2026, 10), to: local(2026, 11) }), 1);
assert.equal(wholeMonths({ from: local(2026, 1), to: local(2027, 1) }), 12);
assert.equal(
  wholeMonths({ from: local(2026, 10, 2), to: local(2026, 11) }),
  null,
);
assert.equal(
  wholeMonths({ from: local(2026, 10), to: local(2026, 10, 31) }),
  null,
);
assert.equal(
  wholeMonths({ from: local(2026, 10, 1, 9), to: local(2026, 11) }),
  null,
);
assert.equal(wholeMonths({}), null);
assert.equal(targetTitle(3), "Quarterly target achievement");
assert.equal(targetTitle(1), "Monthly target achievement");
assert.equal(targetTitle(12), "Yearly target achievement");
assert.equal(targetTitle(null), "Target achievement");

// The trend's buckets: months for the capture's quarter, days for a month, years beyond two.
const quarter = trendBuckets(Q4);
assert.ok(quarter);
assert.equal(quarter.granularity, "month");
assert.deepEqual(quarter.labels, ["Oct", "Nov", "Dec"]);
assert.deepEqual(quarter.edges, [
  local(2026, 10),
  local(2026, 11),
  local(2026, 12),
  local(2027, 1),
]);
const october = trendBuckets({ from: local(2026, 10), to: local(2026, 11) });
assert.ok(october);
assert.equal(october.granularity, "day");
assert.equal(october.labels.length, 31);
assert.equal(october.labels[0], "1 Oct");
assert.equal(october.edges.length, 32);
const year = trendBuckets({ from: local(2025, 7), to: local(2026, 7) });
assert.ok(year);
assert.equal(year.granularity, "month");
assert.equal(year.labels[0], "Jul 2025");
assert.equal(year.labels.length, 12);
const decade = trendBuckets({ from: local(2020, 1), to: local(2026, 7) });
assert.ok(decade);
assert.equal(decade.granularity, "year");
assert.deepEqual(decade.labels, [
  "2020",
  "2021",
  "2022",
  "2023",
  "2024",
  "2025",
  "2026",
]);
assert.equal(decade.edges.at(-1), local(2026, 7));
// A custom range with times is clipped to its own ends.
const timed = trendBuckets({
  from: local(2026, 10, 5, 10),
  to: local(2026, 10, 7, 15),
});
assert.ok(timed);
assert.deepEqual(timed.edges, [
  local(2026, 10, 5, 10),
  local(2026, 10, 6),
  local(2026, 10, 7),
  local(2026, 10, 7, 15),
]);
assert.equal(trendBuckets({}), null);
assert.equal(trendBuckets({ from: Q4.to, to: Q4.from }), null);

// The comparison window: the calendar period before; a custom range's own length before it.
const asked: [string, string][] = [];
const range: PeriodRange = (key, custom, now) => {
  asked.push([key, now.toDateString()]);
  return key === "custom"
    ? { from: local(2026, 10, 1), to: local(2026, 10, 11) }
    : { from: key, to: key };
};
const now = new Date(2026, 9, 27, 9);
const last = () => asked[asked.length - 1];
priorWindow("thisQuarter", {}, range, now);
assert.deepEqual(last(), ["lastQuarter", now.toDateString()]);
priorWindow("lastQuarter", {}, range, now);
assert.deepEqual(last(), ["lastQuarter", new Date(2026, 6, 1).toDateString()]);
priorWindow("lastMonth", {}, range, now);
assert.deepEqual(last(), ["lastMonth", new Date(2026, 8, 1).toDateString()]);
priorWindow("last7Days", {}, range, now);
assert.deepEqual(last(), ["last7Days", new Date(2026, 9, 20).toDateString()]);
priorWindow("today", {}, range, now);
assert.deepEqual(last(), ["yesterday", now.toDateString()]);
priorWindow("lastFinancialYear", {}, range, now);
assert.deepEqual(last(), [
  "lastFinancialYear",
  new Date(2025, 9, 1).toDateString(),
]);
assert.deepEqual(
  priorWindow("custom", { from: "2026-10-01", to: "2026-10-10" }, range, now),
  { from: local(2026, 9, 21), to: local(2026, 10, 1) },
);
assert.equal(priorWindow(null, {}, range, now), null);
assert.equal(comparisonLabel("thisQuarter"), "vs last quarter");
assert.equal(comparisonLabel("custom"), "vs previous period");
assert.equal(comparisonLabel(null), null);

// The value axis: the capture's 0–400,000 in four steps around a 293,853 month.
assert.deepEqual(niceScale(293853), {
  top: 400000,
  ticks: [0, 100000, 200000, 300000, 400000],
});
assert.deepEqual(niceScale(0).ticks, [0, 1, 2, 3, 4]);
for (const max of [1, 99, 3594, 708725, 1145000]) {
  const { top, ticks } = niceScale(max);
  assert.ok(top >= max * 1.2 - 1e-9, `${max} fits under ${top}`);
  assert.equal(ticks[0], 0);
  assert.equal(ticks.at(-1), top);
}

// Rates keep one decimal, as every one in the capture does.
assert.equal(formatRate(28.12), "28.1%");
assert.equal(formatRate(100), "100.0%");
assert.equal(formatRate(79300), "79300.0%");

console.log("revenue-report.check: all assertions passed");
