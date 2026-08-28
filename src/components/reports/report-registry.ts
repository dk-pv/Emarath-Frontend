import type { Icon } from "@tabler/icons-react";
import {
  IconAffiliate,
  IconAlertTriangle,
  IconCalendar,
  IconCalendarEvent,
  IconCalendarUp,
  IconCalendarX,
  IconClockBolt,
  IconCopyCheck,
  IconFilterDollar,
  IconFilterX,
  IconHourglassLow,
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
 * Scope comes from the backlog (project-docs/emarath-backlog.txt) plus direct client requests.
 * The seven RPT-02.x reports are backlog tasks; "Lead Aging & Stale Leads", "Lead First Response"
 * and "Duplicate Enquiries" were added on client request (the first two also appear in Workpex's
 * Leads hub, which shows 8–9 cards across captures) and carry no backlog task yet — see the
 * `taskId` note below. Titles/descriptions for Leads and Follow Ups are transcribed verbatim from
 * the Workpex reference. Sales is NOT a Reports category — in Workpex it lives under the separate
 * Analytics module — so it is defined in ANALYTICS_CATEGORIES below, not here.
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
  /**
   * The backlog task this card will open once its report is built. Absent on cards requested
   * directly by the client that the backlog has not picked up yet — an invented id would assert
   * a task that does not exist. Metadata only; nothing renders it.
   */
  taskId?: string;
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
      // Client-requested (no backlog task yet). Like every other unbuilt report, these route to
      // the shared ReportView placeholder — live shell chrome, no fabricated rows — until their
      // data is available. None of the three has a backend endpoint today.
      {
        slug: "lead-aging-stale-leads",
        title: "Lead Aging & Stale Leads",
        description:
          "Identify neglected and stagnant leads that are at risk of going cold",
        icon: IconHourglassLow,
        accent: "amber",
      },
      {
        slug: "lead-first-response",
        title: "Lead First Response",
        description:
          "Track the time between lead creation and the first recorded activity",
        icon: IconClockBolt,
        accent: "emerald",
      },
      {
        slug: "duplicate-enquiries",
        title: "Duplicate Enquiries",
        description:
          "View the history of duplicate lead enquiries and repeated attempts",
        icon: IconCopyCheck,
        accent: "violet",
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
];

/**
 * The Analytics hub catalogue. In Workpex the Sales reports live under the separate **Analytics**
 * module (`/analytics`, "3 Sales Reports"), NOT under Reports — so they are defined here and the
 * Analytics page renders them with the same hub/section/card components. Titles and descriptions
 * are transcribed verbatim from `ui-reference/analytics/analytics-hub-sales-reports-default.png`.
 * These are hub cards (navigation only); the report screens themselves are future/unticketed, so
 * the `taskId`s are the roadmap-proposed Analytics ids (Revenue maps to the backlog's RPT-04.1).
 */
export const ANALYTICS_CATEGORIES: readonly ReportCategory[] = [
  {
    key: "sales",
    title: "Sales",
    reports: withHrefs("/analytics/sales", [
      {
        taskId: "ANLY-01.1",
        slug: "sales-funnel",
        title: "Sales Funnel Report",
        description: "Analyze full pipeline conversion and funnel ratios",
        icon: IconFilterDollar,
        accent: "sky",
      },
      {
        taskId: "ANLY-01.2",
        slug: "sales-pipeline-analysis",
        title: "Sales Pipeline Analysis",
        description: "Revenue predictability, pipeline health & forecast",
        icon: IconTrendingUp,
        accent: "violet",
      },
      {
        taskId: "RPT-04.1",
        slug: "revenue-report",
        title: "Revenue Report",
        description:
          "Total revenue, deal trends & target achievement in one view.",
        icon: IconReportMoney,
        accent: "emerald",
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

/**
 * Resolve an Analytics report route (`/analytics/<category>/<slug>`) back to its registry entry.
 * Kept separate from `findReport` so the Reports route never resolves an Analytics report (and
 * vice-versa) — each hub only sees its own categories.
 */
export function findAnalyticsReport(
  category: string,
  slug: string,
): ResolvedReport | undefined {
  const href = `/analytics/${category}/${slug}`;
  for (const cat of ANALYTICS_CATEGORIES) {
    const report = cat.reports.find((entry) => entry.href === href);
    if (report) return { report, category: cat };
  }
  return undefined;
}

/** The `[category]`/`[slug]` pairs for every Analytics report, for static route generation. */
export function analyticsRouteParams(): { category: string; slug: string }[] {
  return ANALYTICS_CATEGORIES.flatMap((cat) =>
    cat.reports.map((report) => {
      const [, , category, slug] = report.href.split("/");
      return { category, slug };
    }),
  );
}
