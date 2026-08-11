import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findReport,
  reportRouteParams,
} from "@/components/reports/report-registry";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReportView } from "@/components/reports/report-view";
import { NoActivityLeadsReport } from "@/components/reports/no-activity-leads-report";
import { TodayLeadsReport } from "@/components/reports/today-leads-report";

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
        : ReportView;

  return (
    <PageContainer>
      <Suspense>
        <Body category={category} slug={slug} />
      </Suspense>
    </PageContainer>
  );
}
