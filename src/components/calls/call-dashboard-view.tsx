"use client";

import { useState } from "react";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { CallSummaryCards } from "./call-summary-view";
import { CallLeaderboard } from "./call-leaderboard-view";
import { CallLog } from "./call-log-view";
import { CallPeriodFilter, PERIODS, type PeriodId } from "./call-period-filter";

/**
 * The Call Dashboard client root: the Summary header + period Filter, then the
 * KPI cards (CALL-03.2) and the leaderboard (CALL-04.2). The one Filter drives
 * every section — summary, leaderboard and the Recent Call Log all reflect the
 * selected period — so the period lives here, not in any one section.
 */
export function CallDashboardView() {
  const [period, setPeriod] = useState<PeriodId>("today");
  const periodLabel = PERIODS.find((p) => p.id === period)?.label ?? "Today";

  return (
    <ContentContainer className="p-4 lg:p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">
          Summary{" "}
          <span className="font-normal text-ink-muted">| {periodLabel}</span>
        </h2>
        <CallPeriodFilter value={period} onChange={setPeriod} />
      </header>

      <CallSummaryCards period={period} />
      <CallLeaderboard period={period} />
      {/* key remounts the log on a period change so its page resets to 1. */}
      <CallLog key={period} period={period} />
    </ContentContainer>
  );
}
