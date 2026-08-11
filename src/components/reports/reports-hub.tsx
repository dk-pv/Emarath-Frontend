"use client";

import { Card } from "@/components/ui/Card";
import { ReportCategory } from "./report-category";
import { REPORT_CATEGORIES } from "./report-registry";

/**
 * The Reports hub body (RPT-01.1). A Client Component so the registry — whose cards carry
 * Tabler icon *components* — stays client-side and never crosses the Server→Client boundary
 * (function references can't be serialized). Each category owns its own search and collapse.
 */
export function ReportsHub() {
  return (
    <Card className="divide-y divide-hairline p-0">
      {REPORT_CATEGORIES.map((category) => (
        <div key={category.key} className="p-6 lg:p-8">
          <ReportCategory category={category} />
        </div>
      ))}
    </Card>
  );
}
