import { cn } from "@/lib/cn";
import { formatAEDCompact } from "@/lib/format";
import { StatWave } from "./dashboard-stat-card";
import type { TeamRevenue as TeamRevenueData } from "@/services/dashboard-service";

/** Grouped — the reference's rail reads "1,004", unlike the ungrouped KPI cards. */
const COUNT = new Intl.NumberFormat("en-US");
/** The percentage is a bare integer there: "3722 %", no separator. */
const PCT = new Intl.NumberFormat("en-US", { useGrouping: false });

/** Shared shell: a rounded, tinted panel with the wave pinned to its floor. */
function StatCard({
  title,
  surface,
  wave,
  className,
  children,
}: {
  title: string;
  surface: string;
  wave: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative isolate flex min-h-34 flex-col overflow-hidden rounded-surface p-4",
        surface,
        className,
      )}
    >
      <StatWave className={wave} />
      <h4 className="relative z-10 text-sm font-medium text-ink">{title}</h4>
      <div className="relative z-10">{children}</div>
    </section>
  );
}

/**
 * The Sales Team Activity Board's left rail (DASH-03.2): Team Revenue, Total
 * Conversion and Total % Revenue Target Achieved, stacked.
 *
 * Every figure is real and role-scoped by the API. The percentage is **never
 * clamped** — the reference's own board reads 3722 %, and beating a target is the
 * normal case — and renders `NA` when the team has no target set, which is a
 * different statement from 0 %.
 */
export function TeamRevenue({ totals }: { totals: TeamRevenueData }) {
  return (
    <div className="flex flex-col gap-4">
      <StatCard
        title="Team Revenue"
        surface="bg-linear-to-b from-stat-revenue-from to-stat-revenue-to"
        wave="fill-stat-revenue-wave"
        // Two figures rather than one, so this card is taller — enough that the
        // wave stays clear of the numbers, as it does in the reference.
        className="min-h-39"
      >
        {/* The one card with two figures side by side, under a hairline rule. */}
        <div className="mt-3 border-t border-ink/10 pt-3">
          <dl className="flex gap-10">
            <div>
              <dt className="text-xs text-ink-muted">Total Leads</dt>
              <dd className="mt-1 text-[26px] leading-none font-semibold text-ink">
                {COUNT.format(totals.totalLeads)}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-ink-muted">Total Calls</dt>
              <dd className="mt-1 text-[26px] leading-none font-semibold text-ink">
                {COUNT.format(totals.totalCalls)}
              </dd>
            </div>
          </dl>
        </div>
      </StatCard>

      <StatCard
        title="Total Conversion"
        surface="bg-linear-to-b from-stat-conversion-from to-stat-conversion-to"
        wave="fill-stat-conversion-wave"
      >
        <p className="mt-5 text-[26px] leading-none font-semibold text-ink">
          {/* The reference abbreviates to 3 decimals here — 203.234K — where the
              Kanban totals round to one. */}
          {formatAEDCompact(totals.totalConversion, { digits: 3 })}
        </p>
      </StatCard>

      <StatCard
        title="Total % Revenue Target Achieved"
        surface="bg-linear-to-b from-stat-target-from to-stat-target-to"
        wave="fill-stat-target-wave"
      >
        <p className="mt-5 text-[26px] leading-none font-semibold text-ink">
          {totals.pctRevenueTargetAchieved === null
            ? "NA"
            : `${PCT.format(Math.round(totals.pctRevenueTargetAchieved))} %`}
        </p>
      </StatCard>
    </div>
  );
}
