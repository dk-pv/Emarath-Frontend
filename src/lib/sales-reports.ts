/**
 * The Analytics Sales reports' drawing and formatting rules. Their figures come computed from
 * the server (`GET /reports/sales-funnel`, `GET /reports/sales-pipeline`); what lives here is how
 * the page draws them — funnel widths and step badges, chip labels, counts and ratios.
 */

/**
 * The narrowest funnel segment as a share of the widest: 222 of 597px in the Oct 2026 Full
 * capture, whose lower stages hold 2 leads against New's 7,358.
 */
export const FUNNEL_MIN_WIDTH = 0.37;

/** The badge between two funnel steps: next ÷ previous, or null when the previous is empty. */
export function stepRatio(previous: number, next: number): number | null {
  return previous > 0 ? (next / previous) * 100 : null;
}

/**
 * The step Workpex draws in its warning style: the steepest drop on the funnel, the smallest
 * ratio shown. The Oct 2026 Full capture warns 2.1 % while 3.2 %, 3.5 % and 8.7 % stay plain;
 * the July Live capture warns 5.6 %, its smallest. Null when no badge shows.
 */
export function lowestStep(ratios: readonly (number | null)[]): number | null {
  const shown = ratios.filter((ratio): ratio is number => ratio !== null);
  return shown.length > 0 ? Math.min(...shown) : null;
}

/**
 * A toolbar chip's label as Workpex cuts it: past eight characters, the first eight and "..",
 * so "Last 30 Days" reads "Last 30 .." (the Oct 2026 captures).
 */
export function chipLabel(label: string): string {
  return label.length > 8 ? `${label.slice(0, 8)}..` : label;
}

/**
 * The pipeline's code under each stage name ("LP"): its initials, the backend's own fallback
 * for a pipeline with no short code (the Dashboard's Sales Pipeline captions).
 */
export function pipelineInitials(pipeline: string): string {
  const letters = pipeline
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0].toUpperCase())
    .join("");
  return letters || pipeline;
}

const COUNT = new Intl.NumberFormat("en-AE");

/** 7309 → "7,309". */
export function formatCount(count: number): string {
  return COUNT.format(count);
}

/** 9.2 → "9.2%", 100 → "100%", 366.666… → "366.7%" — the captures' one-decimal style. */
export function formatRatio(percent: number): string {
  return `${Number(percent.toFixed(1))}%`;
}

/**
 * Each segment's width as a share of the widest: linear in the count between the smallest and
 * the largest step on screen, from FUNNEL_MIN_WIDTH to 1 (Workpex's Oct captures: 2 → 37 %,
 * 7,358 → 100 % in Full; Live's New, 1,442 of a 2,420 maximum, at 75 %). Equal counts all draw
 * full width.
 */
export function funnelWidths(counts: readonly number[]): number[] {
  if (counts.length === 0) return [];
  const min = Math.min(...counts);
  const max = Math.max(...counts);
  if (max === min) return counts.map(() => 1);
  return counts.map(
    (count) =>
      FUNNEL_MIN_WIDTH + ((1 - FUNNEL_MIN_WIDTH) * (count - min)) / (max - min),
  );
}

/** "2.50×" — Workpex's two decimals and multiplication sign; a dash where no ratio exists. */
export function formatCoverage(ratio: number | null): string {
  return ratio === null ? "—" : `${ratio.toFixed(2)}×`;
}

/** The 3× rule's zones as the captured badge and legend name them. */
export const COVERAGE_LABELS = {
  critical: "Critical",
  risk: "Risk",
  "on-track": "On track",
} as const;

/** Where a ratio sits on the 0×–5×+ coverage track, as a share of its width (0–100). */
export function coveragePosition(ratio: number): number {
  return Math.min(Math.max(ratio, 0), 5) * 20;
}
