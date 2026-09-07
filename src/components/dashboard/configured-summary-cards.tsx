"use client";

import { useEffect, useState } from "react";
import { IconChartPie, IconTag, type Icon } from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard, type StatCardTone } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { formatAEDCompact } from "@/lib/format";
import { isAbortError } from "@/lib/api-client";
import {
  fetchDashboardSummary,
  type DashboardSummary,
} from "@/services/dashboard-service";

/**
 * The reference gives every KPI card its own accent; nothing in the capture ties a
 * colour to a particular stage, so the row cycles a fixed rotation and a card keeps its
 * colour as long as it keeps its place.
 */
const TONES: StatCardTone[] = [
  "brand",
  "danger",
  "info",
  "violet",
  "success",
  "warning",
  "pink",
];

const MODE_ICON: Record<DashboardSummary["summaryMode"], Icon> = {
  LEAD_STAGE: IconTag,
  LEAD_SOURCE: IconChartPie,
};

/**
 * The summary cards Settings → Application Controls → Dashboard Settings configures.
 *
 * These are real figures, not fixtures: the API counts and sums the caller's own leads
 * by stage or by source, and returns exactly the cards that were selected, in the
 * selected order. `Display On Cards` decides which figure each card leads with.
 *
 * The row renders nothing at all when nothing is configured — that is what an empty
 * selection means, and a placeholder card nobody chose would be worse than a quiet
 * dashboard.
 */
export function ConfiguredSummaryCards() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchDashboardSummary(controller.signal)
      .then((result) => {
        if (!active) return;
        setSummary(result);
      })
      .catch((error: unknown) => {
        // A configured summary that cannot be reached leaves the rest of the dashboard
        // alone; it is one row, not the page.
        if (!active || isAbortError(error)) return;
        setSummary(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, []);

  if (loading) {
    return (
      <MetricCardsRow>
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton
            key={index}
            className="h-[120px] w-[340px] shrink-0 rounded-surface"
          />
        ))}
      </MetricCardsRow>
    );
  }

  if (summary === null || summary.cards.length === 0) return null;

  const icon = MODE_ICON[summary.summaryMode];

  return (
    <MetricCardsRow>
      {summary.cards.map((card, index) => (
        <StatCard
          key={card.fieldKey}
          label={card.label}
          value={
            summary.displayOnCards === "AMOUNT"
              ? formatAEDCompact(card.amount)
              : String(card.count)
          }
          caption={
            summary.displayOnCards === "BOTH"
              ? formatAEDCompact(card.amount)
              : undefined
          }
          tone={TONES[index % TONES.length]}
          icon={icon}
        />
      ))}
    </MetricCardsRow>
  );
}
