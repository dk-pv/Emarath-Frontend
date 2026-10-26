import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import {
  findReport,
  salesReportParams,
} from "@/components/reports/report-registry";
import { SalesFunnelReport } from "@/components/reports/sales/sales-funnel-report";
import { SalesPipelineReport } from "@/components/reports/sales/sales-pipeline-report";
import { SalesReportPlaceholder } from "@/components/reports/sales/sales-report-placeholder";

type RouteParams = { slug: string };

/** Pre-render the four Sales reports; an unknown slug still 404s at request time. */
export function generateStaticParams(): RouteParams[] {
  return salesReportParams();
}

export async function generateMetadata({
  params,
}: {
  params: Promise<RouteParams>;
}): Promise<Metadata> {
  const { slug } = await params;
  const resolved = findReport("sales", slug);
  return {
    title: resolved
      ? `${resolved.report.title} - Emarath`
      : "Reports - Emarath",
  };
}

/**
 * An Analytics Sales report, opened from the Analytics hub in its own tab. The reports read
 * their filters from the URL, so each client body sits under Suspense. Revenue Report and User
 * Scorecard have no Workpex capture yet, so they render the shell with a plain notice.
 */
export default async function SalesReportPage({
  params,
}: {
  params: Promise<RouteParams>;
}) {
  const { slug } = await params;
  if (!findReport("sales", slug)) notFound();

  const Body =
    slug === "sales-funnel"
      ? SalesFunnelReport
      : slug === "sales-pipeline-analysis"
        ? SalesPipelineReport
        : SalesReportPlaceholder;

  return (
    <Suspense>
      <Body slug={slug} />
    </Suspense>
  );
}
