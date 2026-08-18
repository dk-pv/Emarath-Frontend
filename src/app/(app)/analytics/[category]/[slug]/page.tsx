import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  analyticsRouteParams,
  findAnalyticsReport,
} from "@/components/reports/report-registry";
import { PageContainer } from "@/components/layout/PageContainer";
import { ReportView } from "@/components/reports/report-view";

type RouteParams = { category: string; slug: string };

/** Pre-render every known Analytics report route; unknown slugs still 404 at request time. */
export function generateStaticParams(): RouteParams[] {
  return analyticsRouteParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const resolved = findAnalyticsReport(category, slug);
  return {
    title: resolved
      ? `${resolved.report.title} - Emarath`
      : "Analytics - Emarath",
  };
}

/**
 * An Analytics report's dedicated screen. Resolves the report from the Analytics registry — an
 * unknown category/slug is a real 404 — and renders it in the shared shell. None of the Sales
 * reports is built yet, so every one shows the `ReportView` preview (live chrome, no data), the
 * same placeholder the not-yet-built Follow Ups reports use.
 */
export default async function AnalyticsReportPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { category, slug } = await params;
  if (!findAnalyticsReport(category, slug)) notFound();

  return (
    <PageContainer>
      <Suspense>
        <ReportView category={category} slug={slug} />
      </Suspense>
    </PageContainer>
  );
}
