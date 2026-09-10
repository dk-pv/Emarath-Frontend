"use client";

import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useWidgetPeriod } from "./dashboard-widget";
import { WidgetPeriodFilter } from "./widget-period-filter";

/**
 * The Dashboard's system alerts panel (DASH-06.1).
 *
 * **Only the empty state exists in the reference.** No capture in `ui-reference/`
 * shows a populated alert, so no row, severity colour, icon or dismiss control is
 * drawn here — inventing one would be guessing a design (CLAUDE.md §16.4). The
 * panel is the header, the card-scoped period chip and the exact empty state the
 * reference draws: two lines, centred, no illustration and no call to action.
 *
 * **There is no alerts feed to read yet.** DASH-06.1 is a UI task; the alerts
 * service it names is FND-05.1 / INFRA-02.1, which are not built. Rather than
 * invent an endpoint, the panel renders empty and `alerts` is the seam — hand it
 * rows once that service exists and only the body below needs designing, against
 * a captured reference.
 *
 * **The period is this card's own** (DASH-01.2). The reference proves the two are
 * independent: the page chip reads "This Month" while this one reads "Yesterday"
 * in the same frame, so it must not be wired to the Dashboard control row.
 */
export function DashboardAlerts({
  alerts = [],
}: {
  alerts?: readonly unknown[];
}) {
  const { period, setPeriod } = useWidgetPeriod("yesterday");

  return (
    <Card as="section" className="flex min-h-72 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4 pb-3">
        {/* "Workpex Alerts" in the reference. The brand name is one of the three
            things that may differ, and Settings already ships this screen's
            counterpart as "Emarath Alerts" — this follows that existing decision
            rather than making a new one. */}
        <h3 className="text-base font-semibold text-ink">Emarath Alerts</h3>
        <WidgetPeriodFilter
          value={period}
          onChange={setPeriod}
          clearTo="yesterday"
          label="Emarath Alerts period"
        />
      </div>

      <div className="flex flex-1 items-center justify-center">
        {alerts.length === 0 ? (
          <EmptyState
            title="No data available"
            description="There's currently no data to display here."
          />
        ) : null}
      </div>
    </Card>
  );
}
