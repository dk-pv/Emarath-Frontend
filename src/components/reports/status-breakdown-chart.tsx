import { cn } from "@/lib/cn";
import { stageColorClasses } from "@/lib/stage-palette";
import type { StatusCountRow } from "@/services/leads-by-status-report-service";

/**
 * The Leads By Status breakdown chart (RPT-02.3 AC2). A dependency-free horizontal bar per
 * status: bar length is proportional to the count, filled with the status's real Stage colour
 * (KAN-05.2 palette — never an invented hue). Rendered as a list so the status/count/percentage
 * are read by assistive tech; the bars themselves are decorative (`aria-hidden`).
 *
 * No Workpex screenshot captures this report's chart, so this is the minimal literal form of
 * "counts per status shown with a breakdown chart" — deliberately plain, not a bespoke design.
 */
export function StatusBreakdownChart({ rows }: { rows: StatusCountRow[] }) {
  const total = rows.reduce((sum, row) => sum + row.count, 0);
  const max = rows.reduce((peak, row) => Math.max(peak, row.count), 0);

  return (
    <ul className="flex flex-col gap-2">
      {rows.map((row) => {
        const pct = total ? Math.round((row.count / total) * 100) : 0;
        const width = max ? (row.count / max) * 100 : 0;
        return (
          <li key={row.status} className="flex items-center gap-3">
            <span
              className="w-40 shrink-0 truncate text-sm text-ink"
              title={row.status}
            >
              {row.status}
            </span>
            <div
              aria-hidden="true"
              className="relative h-5 flex-1 overflow-hidden rounded-control bg-canvas"
            >
              <div
                className={cn("h-full", stageColorClasses(row.color).swatch)}
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
