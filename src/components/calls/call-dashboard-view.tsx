"use client";

import { useState } from "react";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { CallSummaryCards } from "./call-summary-view";
import { CallLeaderboard } from "./call-leaderboard-view";
import { CallAnalyticsPanels } from "./call-analytics-view";
import { CallLog } from "./call-log-view";
import {
  CallFilterPanel,
  DEFAULT_CALL_FILTERS,
  periodLabel,
  type CallFilterState,
} from "./call-filter-panel";

/**
 * The Call Dashboard client root: the "Summary | <period>" header and the one
 * green Filter, then the KPI carousel (CALL-03.2), the leaderboard (CALL-04.2),
 * the three analytics panels and the Recent Call Log (CALL-05.2 / CALL-06.1).
 *
 * The Filter drives every section — that is why the state lives here and not in
 * any one of them. Each section resolves the same state into the same window, so
 * the cards, the board, the panels and the log can never describe different data.
 */
export function CallDashboardView() {
  const [filters, setFilters] = useState<CallFilterState>(DEFAULT_CALL_FILTERS);

  return (
    <ContentContainer className="flex flex-col gap-4 p-4 lg:p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="text-lg font-semibold text-ink">
          Summary{" "}
          <span className="font-normal text-ink-muted">
            | {periodLabel(filters)}
          </span>
        </h2>
        <CallFilterPanel value={filters} onChange={setFilters} />
      </header>

      <CallSummaryCards filters={filters} />
      <CallLeaderboard filters={filters} />
      <CallAnalyticsPanels filters={filters} />
      <CallLog filters={filters} />
    </ContentContainer>
  );
}
