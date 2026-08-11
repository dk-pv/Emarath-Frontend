import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { REPORT_ACCENTS, type ReportDefinition } from "./report-registry";

/**
 * One report card in the hub (RPT-01.1), traced from `reports-hub-leads-category-card-hover.png`:
 * a tinted icon tile, title, one-line description, and a "View Report" link. The whole card is
 * the link; on hover Workpex tints the border and the "View Report" label in the card's accent
 * hue (the card is the `group`). `mt-auto` pins "View Report" to the bottom so it aligns across a
 * row of cards that the grid stretches to equal height.
 */
export function ReportCard({ report }: { report: ReportDefinition }) {
  const accent = REPORT_ACCENTS[report.accent];
  const Glyph = report.icon;

  return (
    <Link
      href={report.href}
      className={cn(
        "group flex min-h-56 flex-col rounded-surface border border-hairline bg-surface p-6 transition-colors duration-(--duration-shell) ease-shell focus-ring",
        accent.hoverBorder,
      )}
    >
      <span
        className={cn(
          "flex size-14 items-center justify-center rounded-surface",
          accent.tile,
        )}
      >
        <Glyph size={26} stroke={1.75} aria-hidden="true" />
      </span>

      <h3 className="mt-8 text-lg font-semibold text-ink">{report.title}</h3>
      <p className="mt-1 text-sm text-ink-muted">{report.description}</p>

      <span
        className={cn(
          "mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-ink transition-colors duration-(--duration-shell) ease-shell",
          accent.hoverText,
        )}
      >
        View Report
        <IconExternalLink size={16} stroke={1.75} aria-hidden="true" />
      </span>
    </Link>
  );
}
