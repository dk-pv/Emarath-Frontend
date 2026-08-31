"use client";

import { Alert } from "@/components/ui/Alert";
import { SectionHeader } from "@/components/ui/SectionHeader";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { useAuth } from "@/components/auth/auth-context";
import { can } from "@/constants/permissions";
import { DashboardWidget } from "./dashboard-widget";
import { Leaderboard } from "./leaderboard";
import { SummaryCards } from "./summary-cards";
import { TeamRevenue } from "./team-revenue";
import type { DashboardData } from "@/services/dashboard-service";
import type { LeaderboardRow } from "@/types";

/**
 * The Dashboard container (DASH-01.1): the default landing page after login, which
 * hosts every Dashboard widget in a responsive grid and applies role scoping.
 *
 * **There is deliberately no page-level date state here.** The Dashboard's defining
 * behaviour (DASH-01.2) is that each widget carries its own filter, so a shared one
 * would break AC2/AC3 by construction. Period state lives inside `DashboardWidget`,
 * one instance per widget — see `useWidgetPeriod`.
 *
 * Role scoping (AC3) has two layers. Here, at the layout: team-wide widgets render
 * only for a role holding `viewTeamMetrics` (managers and admins), so an agent is
 * never shown a team surface. The second layer is the one that actually protects
 * data — every Dashboard read is scoped in the query by `leadScopeWhere` /
 * `activityScopeWhere` / `callScopeWhere`, so an agent's own widgets return only
 * their own rows regardless of what the UI renders.
 *
 * The figures are still fixtures: no Dashboard API exists until DASH-02.1. Each
 * widget's `load` below is the seam that becomes a real fetch, with nothing else
 * changing — the loading, error and empty states around it are already live.
 */
export function DashboardView({ data }: { data: DashboardData }) {
  const { user } = useAuth();
  const canViewTeamMetrics = can(user?.role, "viewTeamMetrics");

  return (
    <ContentContainer className="flex flex-col gap-4 p-4 lg:p-6">
      <Alert tone="info" title="Sample dashboard — demo data only">
        The layout, per-widget filters and widget states are live; the figures
        are still placeholders. Real role-scoped counters arrive with DASH-02.1.
      </Alert>

      {/* The KPI counters keep their current placeholder form until DASH-02.2,
          which rebuilds them as six independently-filtered cards. */}
      <SummaryCards cards={data.summary} />

      {canViewTeamMetrics && (
        <section className="flex flex-col gap-4">
          <SectionHeader title="Sales Team Activity Board" />
          {/* Team Revenue is a fixed rail beside the leaderboard, which takes the rest. */}
          <DashboardGrid className="md:grid-cols-1 lg:grid-cols-[minmax(0,320px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,320px)_minmax(0,1fr)]">
            <DashboardWidget
              title="Team Revenue"
              defaultPeriod="this-month"
              skeletonClassName="h-56"
              load={() => Promise.resolve(data.totals)}
            >
              {(totals) => <TeamRevenue totals={totals} />}
            </DashboardWidget>

            <DashboardWidget<readonly LeaderboardRow[]>
              title="Leaderboard"
              defaultPeriod="this-month"
              skeletonClassName="h-72"
              emptyTitle="No agent activity yet"
              emptyDescription="Leaderboard standings appear once agents log leads and calls."
              isEmpty={(rows) => rows.length === 0}
              load={() => Promise.resolve(data.leaderboard)}
            >
              {(rows) => <Leaderboard rows={rows} />}
            </DashboardWidget>
          </DashboardGrid>
        </section>
      )}
    </ContentContainer>
  );
}
