import Link from "next/link";
import { IconExternalLink } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { REPORT_ACCENTS, type ReportDefinition } from "./report-registry";

/**
 * Each hub's card geometry. The Analytics card (`analytics-hub-available-categories-default.png`,
 * 2026-10-26) is shorter than the Reports one, with a smaller tile and type, a darker outline,
 * and its title one heading level deeper (the hub has a heading above its categories).
 */
const VARIANTS = {
  reports: {
    card: "min-h-56 rounded-surface border-hairline p-6",
    tile: "size-14 rounded-surface",
    glyph: { size: 26, stroke: 1.75 },
    heading: "h3",
    title: "mt-8 text-lg font-semibold text-ink",
    description: "mt-1 text-sm text-ink-muted",
    action: "gap-1.5 pt-6 text-sm font-semibold text-ink",
    actionIcon: 16,
  },
  analytics: {
    card: "rounded-[20px] border-card-outline px-5.5 pt-4.5 pb-5.5",
    tile: "size-9.5 rounded-control",
    glyph: { size: 20, stroke: 1.5 },
    heading: "h4",
    title: "mt-5.5 text-base font-medium text-ink",
    description: "text-xs leading-4.5 text-ink-soft",
    action: "gap-1 pt-2.5 text-xs font-medium text-ink-soft",
    actionIcon: 14,
  },
} as const;

/**
 * One report card in a hub (RPT-01.1), traced from `reports-hub-leads-category-card-hover.png`:
 * a tinted icon tile, title, one-line description, and a "View Report" link. The whole card is
 * the link; on hover Workpex tints the border and the "View Report" label in the card's accent
 * hue (the card is the `group`). `mt-auto` pins "View Report" to the bottom so it aligns across a
 * row of cards that the grid stretches to equal height.
 */
export function ReportCard({
  report,
  variant = "reports",
}: {
  report: ReportDefinition;
  variant?: keyof typeof VARIANTS;
}) {
  const accent = REPORT_ACCENTS[report.accent];
  const look = VARIANTS[variant];
  const Glyph = report.icon;
  const Heading = look.heading;

  return (
    <Link
      href={report.href}
      className={cn(
        "group flex flex-col border bg-surface transition-colors duration-(--duration-shell) ease-shell focus-ring",
        look.card,
        accent.hoverBorder,
      )}
    >
      <span
        className={cn(
          "flex items-center justify-center",
          look.tile,
          accent.tile,
        )}
      >
        <Glyph
          size={look.glyph.size}
          stroke={look.glyph.stroke}
          aria-hidden="true"
        />
      </span>

      <Heading className={look.title}>{report.title}</Heading>
      <p className={look.description}>{report.description}</p>

      <span
        className={cn(
          "mt-auto inline-flex items-center transition-colors duration-(--duration-shell) ease-shell",
          look.action,
          accent.hoverText,
        )}
      >
        View Report
        <IconExternalLink
          size={look.actionIcon}
          stroke={1.75}
          aria-hidden="true"
        />
      </span>
    </Link>
  );
}
