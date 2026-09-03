import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findReport,
  reportRouteParams,
} from "@/components/reports/report-registry";
import { PageContainer } from "@/components/layout/PageContainer";
import { LeadAgingReport } from "@/components/reports/lead-aging-report";
import { DuplicateEnquiriesReport } from "@/components/reports/duplicate-enquiries-report";
import { LeadFirstResponseReport } from "@/components/reports/lead-first-response-report";
import { ReportView } from "@/components/reports/report-view";
import { NoActivityLeadsReport } from "@/components/reports/no-activity-leads-report";
import { TodayLeadsReport } from "@/components/reports/today-leads-report";
import { LeadsByStatusReport } from "@/components/reports/leads-by-status-report";
import { LeadsBySourceReport } from "@/components/reports/leads-by-source-report";
import { LeadsByOwnershipReport } from "@/components/reports/leads-by-ownership-report";
import { ConvertedLeadsReport } from "@/components/reports/converted-leads-report";
import { LostLeadsReport } from "@/components/reports/lost-leads-report";
import { OverdueFollowUpsReport } from "@/components/reports/overdue-follow-ups-report";
import { TodaysFollowUpsReport } from "@/components/reports/todays-follow-ups-report";
import { UpcomingFollowUpsReport } from "@/components/reports/upcoming-follow-ups-report";

type RouteParams = { category: string; slug: string };

/** Pre-render every known report route; unknown slugs still 404 at request time. */
export function generateStaticParams(): RouteParams[] {
  return reportRouteParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const resolved = findReport(category, slug);
  return {
    title: resolved
      ? `${resolved.report.title} - Emarath`
      : "Reports - Emarath",
  };
}

/**
 * A report's dedicated screen (RPT-01.2). Resolves the report from the registry — an unknown
 * category/slug is a real 404, never a fake report — and renders it in the shared shell. The
 * client host reads `?view`/`?state` from the URL, so it sits under Suspense.
 */
export default async function ReportPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { category, slug } = await params;
  if (!findReport(category, slug)) notFound();

  // Built reports render their own scoped body; the rest fall back to the shell placeholder
  // (RPT-01.2) until their task lands. Add a case per report as it is implemented.
  const Body =
    slug === "no-activity-leads"
      ? NoActivityLeadsReport
      : slug === "today-leads"
        ? TodayLeadsReport
        : slug === "leads-by-status"
          ? LeadsByStatusReport
          : slug === "leads-by-source"
            ? LeadsBySourceReport
            : slug === "leads-by-ownership"
              ? LeadsByOwnershipReport
              : slug === "converted-leads"
                ? ConvertedLeadsReport
                : slug === "lost-leads"
                  ? LostLeadsReport
                  : slug === "overdue-follow-ups"
                    ? OverdueFollowUpsReport
                    : slug === "todays-follow-ups"
                      ? TodaysFollowUpsReport
                      : slug === "upcoming-follow-ups"
                        ? UpcomingFollowUpsReport
                        : slug === "lead-aging-stale-leads"
                          ? LeadAgingReport
                          : slug === "lead-first-response"
                            ? LeadFirstResponseReport
                            : slug === "duplicate-enquiries"
                              ? DuplicateEnquiriesReport
                              : ReportView;

  return (
    <PageContainer>
      <Suspense>
        <Body category={category} slug={slug} />
      </Suspense>
    </PageContainer>
  );
}
