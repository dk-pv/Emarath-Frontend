import type { Icon } from "@tabler/icons-react";
import {
  IconAffiliate,
  IconAlertTriangle,
  IconCalendar,
  IconCalendarEvent,
  IconCalendarUp,
  IconCalendarX,
  IconFilterDollar,
  IconFilterX,
  IconReportMoney,
  IconStatusChange,
  IconTrendingUp,
  IconUsers,
} from "@tabler/icons-react";

/**
 * The Reports hub catalogue (RPT-01.1) — the single source of truth for every hub card:
 * its RPT task, slug, title, description, icon, accent, and destination href. The hub is
 * pure navigation: it lists the pre-built reports and links out; the report screens
 * themselves arrive with the shell (RPT-01.2) and are intentionally not built here.
 *
 * Scope authority is the backlog (project-docs/emarath-backlog.txt), NOT Workpex. Workpex's
 * Leads hub shows 8–9 cards across captures (it adds "Lead Aging & Stale Leads" and, in the
 * overview video, "Lead First Response"); neither is one of the seven RPT-02.x tasks, so both
 * are deliberately omitted. Titles/descriptions for Leads and Follow Ups are transcribed
 * verbatim from the Workpex reference; the Sales section is not shown in any supplied
 * reference, so its titles/descriptions/icons fall back to the backlog (RPT-04.1/04.2).
 */

/** A hue key → literal Tailwind classes. Literal so Tailwind emits them (see stage-palette.ts, CLAUDE.md §7). */
export type ReportAccent =
  "rose" | "green" | "sky" | "violet" | "orange" | "amber" | "emerald";

export interface ReportAccentClasses {
  /** Icon tile: light tint fill + saturated glyph. */
  tile: string;
  /** Card border on hover — Workpex tints the whole card in its accent hue. */
  hoverBorder: string;
  /** "View Report" turns the accent hue on hover (the card is the `group`). */
  hoverText: string;
}

export const REPORT_ACCENTS: Record<ReportAccent, ReportAccentClasses> = {
  rose: {
    tile: "bg-rose-100 text-rose-600",
    hoverBorder: "hover:border-rose-300",
    hoverText: "group-hover:text-rose-600",
  },
  green: {
    tile: "bg-green-100 text-green-600",
    hoverBorder: "hover:border-green-300",
    hoverText: "group-hover:text-green-600",
  },
  sky: {
    tile: "bg-sky-100 text-sky-600",
    hoverBorder: "hover:border-sky-300",
    hoverText: "group-hover:text-sky-600",
  },
  violet: {
    tile: "bg-violet-100 text-violet-600",
    hoverBorder: "hover:border-violet-300",
    hoverText: "group-hover:text-violet-600",
  },
  orange: {
    tile: "bg-orange-100 text-orange-600",
    hoverBorder: "hover:border-orange-300",
    hoverText: "group-hover:text-orange-600",
  },
  amber: {
    tile: "bg-amber-100 text-amber-600",
    hoverBorder: "hover:border-amber-300",
    hoverText: "group-hover:text-amber-600",
  },
  emerald: {
    tile: "bg-emerald-100 text-emerald-600",
    hoverBorder: "hover:border-emerald-300",
    hoverText: "group-hover:text-emerald-600",
  },
};

export interface ReportDefinition {
  /** The backlog task this card will open once its report is built. */
  taskId: string;
  slug: string;
  title: string;
  description: string;
  icon: Icon;
  accent: ReportAccent;
  /** `${category.basePath}/${slug}` — the report screen (built later, RPT-01.2+). */
  href: string;
}

export interface ReportCategory {
  key: string;
  /** Section label and the noun in the count line ("7 Leads Reports"). */
  title: string;
  reports: ReportDefinition[];
}

/** Attach `href` from the category base + slug so the slug lives in exactly one place. */
function withHrefs(
  basePath: string,
  reports: readonly Omit<ReportDefinition, "href">[],
): ReportDefinition[] {
  return reports.map((report) => ({
    ...report,
    href: `${basePath}/${report.slug}`,
  }));
}

export const REPORT_CATEGORIES: readonly ReportCategory[] = [
  {
    key: "leads",
    title: "Leads",
    reports: withHrefs("/reports/lead", [
      {
        taskId: "RPT-02.1",
        slug: "no-activity-leads",
        title: "No Activity Leads",
        description: "Leads with no recent activity or engagement",
        icon: IconAlertTriangle,
        accent: "rose",
      },
      {
        taskId: "RPT-02.2",
        slug: "today-leads",
        title: "Today Leads",
        description: "Recently contacted leads with high engagement",
        icon: IconCalendar,
        accent: "green",
      },
      {
        taskId: "RPT-02.3",
        slug: "leads-by-status",
        title: "Leads By Status",
        description: "View leads categorized by their current status",
        icon: IconStatusChange,
        accent: "sky",
      },
      {
        taskId: "RPT-02.4",
        slug: "leads-by-source",
        title: "Leads By Source",
        description: "Analyze leads based on their source of origin",
        icon: IconAffiliate,
        accent: "violet",
      },
      {
        taskId: "RPT-02.5",
        slug: "leads-by-ownership",
        title: "Leads By Ownership",
        description: "Track leads assigned to different team members",
        icon: IconUsers,
        accent: "rose",
      },
      {
        taskId: "RPT-02.6",
        slug: "converted-leads",
        title: "Converted Leads",
        description: "View successfully converted leads and their metrics",
        icon: IconFilterDollar,
        accent: "orange",
      },
      {
        taskId: "RPT-02.7",
        slug: "lost-leads",
        title: "Lost Leads",
        description: "Analyze leads that were lost and reasons why",
        icon: IconFilterX,
        accent: "rose",
      },
    ]),
  },
  {
    key: "follow-ups",
    title: "Follow Ups",
    // Names are the three observed in Workpex; the backlog names differ and are "to be
    // confirmed with the client", so only Overdue maps to its exact backlog task
    // (RPT-03.2) — the other two carry their remaining task ids until the names are fixed.
    reports: withHrefs("/reports/follow-up", [
      {
        taskId: "RPT-03.2",
        slug: "overdue-follow-ups",
        title: "Overdue Follow Ups",
        description: "Follow ups that are past their due date",
        icon: IconCalendarX,
        accent: "amber",
      },
      {
        taskId: "RPT-03.1",
        slug: "todays-follow-ups",
        title: "Today's Follow Ups",
        description: "Follow ups scheduled for today",
        icon: IconCalendarEvent,
        accent: "green",
      },
      {
        taskId: "RPT-03.3",
        slug: "upcoming-follow-ups",
        title: "Upcoming Follow Ups",
        description: "Follow ups scheduled for future dates",
        icon: IconCalendarUp,
        accent: "rose",
      },
    ]),
  },
  {
    key: "sales",
    title: "Sales",
    // Not shown in any supplied reference — titles/descriptions/icons are the backlog
    // fallback (RPT-04.1/04.2), which the backlog itself says are "to be confirmed".
    reports: withHrefs("/reports/sales", [
      {
        taskId: "RPT-04.1",
        slug: "sales-revenue",
        title: "Sales Revenue",
        description: "Track revenue performance over the period in AED",
        icon: IconReportMoney,
        accent: "emerald",
      },
      {
        taskId: "RPT-04.2",
        slug: "sales-conversion",
        title: "Sales Conversion",
        description: "Measure conversion performance by team or period",
        icon: IconTrendingUp,
        accent: "violet",
      },
    ]),
  },
];

/** A resolved report plus the category it belongs to (its siblings drive the shell's header dropdown). */
export interface ResolvedReport {
  report: ReportDefinition;
  category: ReportCategory;
}

/**
 * Resolve a report route (`/reports/<category>/<slug>`) back to its registry entry so the
 * shell never duplicates titles/slugs. Returns undefined for an unknown category/slug — the
 * route turns that into a proper 404 rather than rendering a fake report.
 */
export function findReport(
  category: string,
  slug: string,
): ResolvedReport | undefined {
  const href = `/reports/${category}/${slug}`;
  for (const cat of REPORT_CATEGORIES) {
    const report = cat.reports.find((entry) => entry.href === href);
    if (report) return { report, category: cat };
  }
  return undefined;
}

/** The `[category]`/`[slug]` pairs for every report, for static route generation. */
export function reportRouteParams(): { category: string; slug: string }[] {
  return REPORT_CATEGORIES.flatMap((cat) =>
    cat.reports.map((report) => {
      const [, , category, slug] = report.href.split("/");
      return { category, slug };
    }),
  );
}
