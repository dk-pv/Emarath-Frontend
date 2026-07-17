"use client";

import { useState } from "react";
import { IconCalendar } from "@tabler/icons-react";
import { Chip } from "@/components/ui/Chip";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { Leaderboard } from "./leaderboard";
import { SummaryCards } from "./summary-cards";
import { TeamRevenue } from "./team-revenue";
import type { DashboardData } from "@/services/dashboard-service";

/**
 * Workpex dashboard layout: a period filter, the KPI carousel, then the Sales Team
 * Activity Board (Team Revenue beside the Leaderboard).
 *
 * Data is fixture-only — no backend exists yet.
 */
export function DashboardView({ data }: { data: DashboardData }) {
  const [period, setPeriod] = useState<string | null>("This Month");

  return (
    <ContentContainer className="p-4 lg:p-6">
      <div className="flex justify-end">
        {period && (
          <Chip icon={IconCalendar} onRemove={() => setPeriod(null)}>
            {period}
          </Chip>
        )}
      </div>

      <SummaryCards cards={data.summary} />

      <section className="rounded-surface border border-hairline bg-surface p-5">
        <SectionHeader title="Sales Team Activity Board" />
        {/* Team Revenue is a fixed rail beside the leaderboard, which takes the rest. */}
        <DashboardGrid className="mt-4 md:grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
          <TeamRevenue />
          <Leaderboard rows={data.leaderboard} />
        </DashboardGrid>
      </section>
    </ContentContainer>
  );
}
