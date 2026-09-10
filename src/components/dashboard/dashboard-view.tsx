"use client";

import { Suspense } from "react";
import { Card } from "@/components/ui/Card";
import { ContentContainer } from "@/components/layout/ContentContainer";
import { DashboardGrid } from "@/components/layout/DashboardGrid";
import { useAuth } from "@/components/auth/auth-context";
import { can } from "@/constants/permissions";
import { DashboardToolbar } from "./dashboard-toolbar";
import { DashboardWidget } from "./dashboard-widget";
import { CallActivityBoard } from "./call-activity-board";
import { DashboardAlerts } from "./dashboard-alerts";
import { Leaderboard } from "./leaderboard";
import { ConfiguredSummaryCards } from "./configured-summary-cards";
import {
  DashboardKpiCarousel,
  DashboardKpiCarouselSkeleton,
} from "./dashboard-kpi-carousel";
import { TeamRevenue } from "./team-revenue";
import {
  fetchSalesLeaderboard,
  fetchTeamRevenue,
  type SalesLeaderboardEntry,
} from "@/services/dashboard-service";

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
 * Every widget on the page now reads real, role-scoped figures. Each one keeps its
 * own period and its own loading / error / empty states, so a slow or failing widget
 * leaves the rest of the page working.
 */
export function DashboardView() {
  const { user } = useAuth();
  const canViewTeamMetrics = can(user?.role, "viewTeamMetrics");

  return (
    <ContentContainer className="flex flex-col gap-4 p-4 lg:p-6">
      {/* Workpex's Dashboard control row sits directly under the application header,
          right-aligned, above the cards. It reads its selections from the URL, so it
          renders under Suspense rather than opting the whole page out of prerender. */}
      <Suspense fallback={<div className="h-control-md" />}>
        <DashboardToolbar />
      </Suspense>

      {/* The nineteen KPI cards, directly under the control row and above every
          other widget — the order dashboard-home-default-top.png shows, with
          nothing between the two. Reads the row's period from the URL, so it
          renders under its own Suspense boundary rather than opting the whole
          page out of prerender. */}
      <Suspense fallback={<DashboardKpiCarouselSkeleton />}>
        <DashboardKpiCarousel />
      </Suspense>

      {/*
        The cards Settings → Application Controls → Dashboard Settings configures.
        Its own row rather than part of the carousel above: these are chosen per
        installation and vary in number, where the carousel above is Workpex's own
        fixed nineteen.
      */}
      <ConfiguredSummaryCards />

      {canViewTeamMetrics && (
        <Card as="section" className="flex flex-col gap-4 p-5">
          {/* One outer container holding both halves, as the reference draws it —
              the heading belongs to the board, not to either widget inside it. */}
          <h2 className="text-lg font-semibold text-ink">
            Sales Team Activity Board
          </h2>

          {/* The stat rail is a fixed 324px (reference 360 × 0.9); the leaderboard
              takes the rest and scrolls inside its own track. */}
          <DashboardGrid className="gap-4 md:grid-cols-1 lg:grid-cols-[minmax(0,324px)_minmax(0,1fr)] xl:grid-cols-[minmax(0,324px)_minmax(0,1fr)]">
            <DashboardWidget
              title="Team Revenue"
              defaultPeriod="this-month"
              filterable={false}
              chromeless
              skeletonClassName="h-[26rem]"
              load={(range, signal) => fetchTeamRevenue(range, signal)}
            >
              {(totals) => <TeamRevenue totals={totals} />}
            </DashboardWidget>

            <DashboardWidget<SalesLeaderboardEntry[]>
              title="Leaderboard"
              defaultPeriod="this-month"
              filterable={false}
              skeletonClassName="h-[24rem]"
              emptyTitle="No agent activity yet"
              emptyDescription="Leaderboard standings appear once agents log leads and calls."
              isEmpty={(rows) => rows.length === 0}
              load={(range, signal) => fetchSalesLeaderboard(range, signal)}
            >
              {(rows) => (
                <div className="p-4">
                  <Leaderboard rows={rows} />
                </div>
              )}
            </DashboardWidget>
          </DashboardGrid>
        </Card>
      )}

      {/* Call Activity Board beside the alerts panel — the reference's 60/40 split
          with a 28px gutter (measured 985/623 across a 1639px content width). */}
      <DashboardGrid className="gap-7 md:grid-cols-1 lg:grid-cols-[minmax(0,60fr)_minmax(0,38fr)] lg:gap-7 xl:grid-cols-[minmax(0,60fr)_minmax(0,38fr)]">
        {/* Owns its own period, paging and states — see the component. */}
        <CallActivityBoard />

        <DashboardAlerts />
      </DashboardGrid>
    </ContentContainer>
  );
}
