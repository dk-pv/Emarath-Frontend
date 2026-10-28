/**
 * The Revenue Report's windows and drawing rules (ADR-0099 decision 15). The figures come
 * computed from `GET /reports/revenue`; what lives here is what only the browser can resolve in
 * its own timezone — the period's name ("Q4 2026"), the window it is compared with, the whole
 * calendar months it spans and the trend's buckets — and how the page draws the figures.
 */

type Window = { from?: string; to?: string };

/**
 * The presets the Analytics toolbar offers (`SALES_PERIODS`), plus the "yesterday" a day is
 * compared with — the leads-by-status service's period keys this module handles, declared here
 * so this module imports nothing and its self-check compiles on its own.
 */
type PeriodKey =
  | "today"
  | "yesterday"
  | "last7Days"
  | "thisWeek"
  | "lastWeek"
  | "last30Days"
  | "thisMonth"
  | "lastMonth"
  | "thisQuarter"
  | "lastQuarter"
  | "thisFinancialYear"
  | "lastFinancialYear"
  | "custom";

/** `periodRange` from the leads-by-status service: a preset's window as of `now`. */
export type PeriodRange = (key: PeriodKey, custom: Window, now: Date) => Window;

const DAY_MS = 86_400_000;
/** Three letters, as the capture's "Oct" — en-GB's ICU data now writes "Sept". */
const MONTH = new Intl.DateTimeFormat("en-US", { month: "short" });

/** "21 Oct", with the year when asked — "28 Dec 2025". */
function dayText(date: Date, withYear: boolean): string {
  const day = `${date.getDate()} ${MONTH.format(date)}`;
  return withYear ? `${day} ${date.getFullYear()}` : day;
}

/**
 * The period as the header names it — Workpex's "Q4 2026 · All agents · All pipelines": a
 * quarter, a month or a financial year by its name, any other window by its first and last day.
 */
export function revenuePeriodLabel(
  period: string | null,
  window: Window,
): string {
  if (!period || !window.from || !window.to) return "All time";
  const from = new Date(window.from);
  const last = new Date(new Date(window.to).getTime() - 1);
  switch (period) {
    case "thisQuarter":
    case "lastQuarter":
      return `Q${Math.floor(from.getMonth() / 3) + 1} ${from.getFullYear()}`;
    case "thisMonth":
    case "lastMonth":
      return `${MONTH.format(from)} ${from.getFullYear()}`;
    case "thisFinancialYear":
    case "lastFinancialYear":
      return `FY ${from.getFullYear()}`;
    default:
      if (from.toDateString() === last.toDateString())
        return dayText(from, true);
      return `${dayText(from, from.getFullYear() !== last.getFullYear())} – ${dayText(last, true)}`;
  }
}

/** "Q4 2026 · All agents · All pipelines" — the header's line under the title. */
export function revenueSubtitle(
  period: string,
  agent: string | undefined,
  pipeline: string | null,
): string {
  return [period, agent ?? "All agents", pipeline ?? "All pipelines"].join(
    " · ",
  );
}

/** A local time's wall-clock reading, as a UTC timestamp — and back. */
const wallClock = (date: Date) =>
  Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
    date.getHours(),
    date.getMinutes(),
    date.getSeconds(),
    date.getMilliseconds(),
  );
const fromWallClock = (time: number) => {
  const wall = new Date(time);
  return new Date(
    wall.getUTCFullYear(),
    wall.getUTCMonth(),
    wall.getUTCDate(),
    wall.getUTCHours(),
    wall.getUTCMinutes(),
    wall.getUTCSeconds(),
    wall.getUTCMilliseconds(),
  );
};

const shiftDays = (now: Date, days: number) =>
  new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12);
const shiftMonths = (now: Date, months: number) =>
  new Date(now.getFullYear(), now.getMonth() + months, 1, 12);

/**
 * The window a period is compared with ("vs last quarter"): the calendar period before it for
 * the named presets, and for a custom range the same length immediately before it. Null for all
 * time, which has nothing before it.
 */
export function priorWindow(
  period: string | null,
  custom: Window,
  periodRange: PeriodRange,
  now = new Date(),
): Window | null {
  switch (period) {
    case "today":
      return periodRange("yesterday", {}, now);
    case "last7Days":
      return periodRange("last7Days", {}, shiftDays(now, -7));
    case "last30Days":
      return periodRange("last30Days", {}, shiftDays(now, -30));
    case "thisWeek":
      return periodRange("lastWeek", {}, now);
    case "lastWeek":
      return periodRange("lastWeek", {}, shiftDays(now, -7));
    case "thisMonth":
      return periodRange("lastMonth", {}, now);
    case "lastMonth":
      return periodRange("lastMonth", {}, shiftMonths(now, -1));
    case "thisQuarter":
      return periodRange("lastQuarter", {}, now);
    case "lastQuarter":
      return periodRange("lastQuarter", {}, shiftMonths(now, -3));
    case "thisFinancialYear":
      return periodRange("lastFinancialYear", {}, now);
    case "lastFinancialYear":
      return periodRange("lastFinancialYear", {}, shiftMonths(now, -12));
    case "custom": {
      const { from, to } = periodRange("custom", custom, now);
      if (!from || !to) return null;
      // Measured and shifted on the wall clock, so a range of whole days stays whole days
      // across a daylight-saving change.
      const start = wallClock(new Date(from));
      const length = wallClock(new Date(to)) - start;
      return length > 0
        ? { from: fromWallClock(start - length).toISOString(), to: from }
        : null;
    }
    default:
      return null;
  }
}

const COMPARISON: Partial<Record<string, string>> = {
  today: "vs yesterday",
  last7Days: "vs previous 7 days",
  thisWeek: "vs last week",
  lastWeek: "vs previous week",
  last30Days: "vs previous 30 days",
  thisMonth: "vs last month",
  lastMonth: "vs previous month",
  thisQuarter: "vs last quarter",
  lastQuarter: "vs previous quarter",
  thisFinancialYear: "vs last financial year",
  lastFinancialYear: "vs previous financial year",
  custom: "vs previous period",
};

/** The KPI cards' comparison line, Workpex's "vs last quarter". */
export function comparisonLabel(period: string | null): string | null {
  return period ? (COMPARISON[period] ?? null) : null;
}

const isMonthStart = (date: Date) =>
  date.getDate() === 1 &&
  date.getHours() === 0 &&
  date.getMinutes() === 0 &&
  date.getSeconds() === 0 &&
  date.getMilliseconds() === 0;

/**
 * How many whole calendar months the window spans in this timezone — the multiple of the
 * monthly goals that makes its target (a quarter is 3). Null when it starts or ends mid-month:
 * the goals are monthly, and no rule splits one.
 */
export function wholeMonths(window: Window): number | null {
  if (!window.from || !window.to) return null;
  const from = new Date(window.from);
  const to = new Date(window.to);
  if (!isMonthStart(from) || !isMonthStart(to)) return null;
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    to.getMonth() -
    from.getMonth();
  return months > 0 && months <= 120 ? months : null;
}

/** "Quarterly target achievement", Workpex's gauge title for its quarter. */
export function targetTitle(months: number | null): string {
  if (months === 1) return "Monthly target achievement";
  if (months === 3) return "Quarterly target achievement";
  if (months === 12) return "Yearly target achievement";
  return "Target achievement";
}

export type TrendGranularity = "day" | "month" | "year";

export const GRANULARITY_TITLE: Record<TrendGranularity, string> = {
  day: "Daily",
  month: "Monthly",
  year: "Yearly",
};

/** The most buckets one trend draws; the API takes one edge more. */
const MAX_BUCKETS = 60;

function nextEdge(date: Date, granularity: TrendGranularity): Date {
  if (granularity === "day")
    return new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1);
  if (granularity === "month")
    return new Date(date.getFullYear(), date.getMonth() + 1, 1);
  return new Date(date.getFullYear() + 1, 0, 1);
}

/**
 * The Revenue Trend's buckets for a window, in this timezone: days for a month or less, months
 * up to two years — the capture's "This Quarter — Monthly Revenue" — and years beyond. Each
 * bucket starts at a local midnight, month or year edge, clipped to the window. Null for all
 * time, which has no edges to draw between.
 */
export function trendBuckets(window: Window): {
  granularity: TrendGranularity;
  edges: string[];
  labels: string[];
} | null {
  if (!window.from || !window.to) return null;
  const from = new Date(window.from);
  const to = new Date(window.to);
  if (to <= from) return null;
  const months =
    (to.getFullYear() - from.getFullYear()) * 12 +
    to.getMonth() -
    from.getMonth();
  // An hour's slack keeps a 31-day month daily across a clock change.
  const granularity: TrendGranularity =
    to.getTime() - from.getTime() <= 31 * DAY_MS + 3_600_000
      ? "day"
      : months <= 24
        ? "month"
        : "year";

  const edges = [from];
  for (let next = nextEdge(from, granularity); next < to;) {
    edges.push(next);
    next = nextEdge(next, granularity);
  }
  edges.push(to);
  if (edges.length - 1 > MAX_BUCKETS) return null;

  const spansYears =
    from.getFullYear() !== new Date(to.getTime() - 1).getFullYear();
  const labels = edges
    .slice(0, -1)
    .map((edge) =>
      granularity === "day"
        ? dayText(edge, false)
        : granularity === "month"
          ? spansYears
            ? `${MONTH.format(edge)} ${edge.getFullYear()}`
            : MONTH.format(edge)
          : String(edge.getFullYear()),
    );
  return {
    granularity,
    edges: edges.map((edge) => edge.toISOString()),
    labels,
  };
}

/**
 * The trend's value axis: four steps of 1, 2, 2.5 or 5 × 10ⁿ AED reaching past the tallest bar
 * with a fifth of headroom — the capture's 0 to 400,000 around a 293,853 month.
 */
export function niceScale(max: number): { top: number; ticks: number[] } {
  const target = Math.max(max, 0) * 1.2 || 4;
  const raw = target / 4;
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const step = Math.max(
    1,
    [1, 2, 2.5, 5, 10].map((f) => f * magnitude).find((s) => s >= raw) ??
      10 * magnitude,
  );
  const top = Math.ceil(target / step) * step;
  const ticks: number[] = [];
  for (let tick = 0; tick <= top + step / 2; tick += step) ticks.push(tick);
  return { top, ticks };
}

/** 28.12 → "28.1%", 100 → "100.0%" — the capture's one decimal on every rate. */
export function formatRate(percent: number): string {
  return `${percent.toFixed(1)}%`;
}
