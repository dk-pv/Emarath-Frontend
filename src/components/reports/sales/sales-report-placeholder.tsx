"use client";

import { IconReportAnalytics } from "@tabler/icons-react";
import { SalesReportFrame } from "./sales-report-frame";
import { SalesPanelEmpty } from "./sales-report-parts";

/**
 * Revenue Report and User Scorecard: no Workpex capture shows either page, so they get the
 * shared shell — sidebar, title and report switcher — and the notice every unbuilt report
 * shows, with no toolbar, cards or figures guessed from elsewhere.
 */
export function SalesReportPlaceholder({ slug }: { slug: string }) {
  return (
    <SalesReportFrame slug={slug}>
      <div className="mt-2 flex min-h-96 flex-col rounded-[18px] border border-hairline">
        <SalesPanelEmpty
          icon={IconReportAnalytics}
          title="Report coming soon"
          description="This report’s data will appear here once the report is built."
        />
      </div>
    </SalesReportFrame>
  );
}
