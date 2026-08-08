import { Card, CardContent } from "@/components/ui/Card";
import { Separator } from "@/components/ui/Separator";
import { TEAM_TOTALS } from "@/constants/dashboard";

/**
 * Left column of the Workpex "Sales Team Activity Board": a Team Revenue panel with
 * Total Leads / Total Calls, and a Total Conversion panel beneath it.
 *
 * Currency is AED throughout the product.
 */
export function TeamRevenue() {
  return (
    <div className="flex flex-col gap-4">
      <Card className="bg-[#eef0fb]">
        <CardContent className="p-5">
          <p className="text-[17px] font-medium text-ink">Team Revenue</p>
          <Separator className="my-3" />
          <dl className="flex gap-10">
            <div>
              <dt className="text-[15px] text-ink-muted">Total Leads</dt>
              <dd className="mt-1 text-[28px] font-semibold text-ink">
                {TEAM_TOTALS.totalLeads}
              </dd>
            </div>
            <div>
              <dt className="text-[15px] text-ink-muted">Total Calls</dt>
              <dd className="mt-1 text-[28px] font-semibold text-ink">
                {TEAM_TOTALS.totalCalls}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      <Card className="bg-[#fdf6e3]">
        <CardContent className="p-5">
          <p className="text-[17px] font-medium text-ink">Total Conversion</p>
          <p className="mt-3 text-[28px] font-semibold text-ink">
            {TEAM_TOTALS.totalConversion}
            <span className="ml-1 text-[17px] font-normal text-ink-muted">
              AED
            </span>
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
