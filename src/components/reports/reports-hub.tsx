"use client";

import { Card } from "@/components/ui/Card";
import { ReportCategory } from "./report-category";
import { ANALYTICS_CATEGORIES, REPORT_CATEGORIES } from "./report-registry";

/**
 * A category-hub body (RPT-01.1) — the Reports hub, and the Analytics hub with the same chrome.
 * A Client Component so the registry — whose cards carry Tabler icon *components* — stays
 * client-side and never crosses the Server→Client boundary (function references can't be
 * serialized). That is why the caller selects a hub by a plain string `variant`, not by passing
 * the categories array: the array is resolved here, client-side. Each category owns its own
 * search and collapse.
 */
export function ReportsHub({
  variant = "reports",
}: {
  variant?: "reports" | "analytics";
}) {
  // The Reports hub lists every business area — Leads, Follow Ups and Sales. The Analytics
  // hub is a second entry point to the Sales cards; both open the same /reports/sales screens.
  const categories =
    variant === "analytics"
      ? ANALYTICS_CATEGORIES
      : [...REPORT_CATEGORIES, ...ANALYTICS_CATEGORIES];

  return (
    <Card className="divide-y divide-hairline p-0">
      {categories.map((category) => (
        <div key={category.key} className="p-6 lg:p-8">
          <ReportCategory category={category} />
        </div>
      ))}
    </Card>
  );
}
