import type { SourceCountRow } from "@/services/leads-by-source-report-service";

/**
 * The Leads By Source breakdown chart (RPT-02.4 AC2). A dependency-free horizontal bar per
 * source: bar length is proportional to the count, and each row shows the count and its share
 * of the total. Rendered as a list so the source/count/share are read by assistive tech; the
 * bars themselves are decorative (`aria-hidden`).
 *
 * Sources are free-text with no catalogue (unlike statuses, which carry Stage colours), so every
 * bar uses one brand fill rather than an invented per-source palette. No Workpex screenshot
 * captures this report's chart, so this is the minimal literal form of "counts and share per
 * source" — deliberately plain, not a bespoke design.
 */
export function SourceBreakdownChart({ rows }: { rows: SourceCountRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = rows.reduce((peak, row) => Math.max(peak, row.count), 0);

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const pct = total ? Math.round((row.count / total) * 1000) / 10 : 0;
        const width = max ? (row.count / max) * 100 : 0;
        return (
          <li key={row.source} className="flex items-center gap-3">
            <span
              className="w-40 shrink-0 truncate text-sm text-ink"
              title={row.source}
            >
              {row.source}
            </span>
            <div
              aria-hidden="true"
              className="relative h-5 flex-1 overflow-hidden rounded-control bg-canvas"
            >
              <div
                className="h-full bg-brand"
                style={{ width: `${width}%` }}
              />
            </div>
            <span className="w-28 shrink-0 text-right text-sm tabular-nums text-ink-muted">
              {row.count.toLocaleString("en-US")}{" "}
              <span className="text-ink-subtle">({pct}%)</span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
