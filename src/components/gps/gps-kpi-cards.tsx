"use client";

import {
  IconChecklist,
  IconCircleArrowDown,
  IconCircleArrowUp,
  IconCurrentLocation,
  IconMapPin,
  type Icon,
} from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGpsSummary } from "@/hooks/use-gps-summary";
import type { GpsSummaryRecord } from "@/services/gps-service";
import type { ListQuery, Tone } from "@/types";

/**
 * The five field-activity counters at the top of the GPS Map screen (GPS-04.2),
 * per ui-reference/gps-map/gps-map-map-view-zero-state-no-markers.png. Workpex's
 * per-card accent colours (orange / pink / blue / purple / green) map to the
 * nearest Emarath tone token — the primary palette is an allowed difference, and
 * StatCard forbids inline hex.
 */
const CARDS: {
  key: keyof GpsSummaryRecord;
  label: string;
  caption: string;
  tone: Tone;
  icon: Icon;
}[] = [
  {
    key: "totalCheckIns",
    label: "Total Check-ins",
    caption: "All check-ins recorded",
    tone: "warning",
    icon: IconCircleArrowDown,
  },
  {
    key: "totalCheckOuts",
    label: "Total Check-outs",
    caption: "All check-outs logged",
    tone: "danger",
    icon: IconCircleArrowUp,
  },
  {
    key: "locationCheckIns",
    label: "Location Check-Ins",
    caption: "Check-ins at all locations",
    tone: "info",
    icon: IconMapPin,
  },
  {
    key: "automaticTracking",
    label: "Automatic Tracking",
    caption: "Locations tracked automatically",
    tone: "brand",
    icon: IconCurrentLocation,
  },
  {
    key: "followUpCompletions",
    label: "Follow-up Completions",
    caption: "Follow-ups completed",
    tone: "success",
    icon: IconChecklist,
  },
];

const CARD_WIDTH = "w-72";
const numberFormat = new Intl.NumberFormat("en-US");

export function GpsKpiCards({
  query,
  reloadToken,
}: {
  query: ListQuery;
  reloadToken: number;
}) {
  const { summary, isLoading, isError } = useGpsSummary(query, reloadToken);

  if (isError) {
    return (
      <ErrorState
        title="Couldn't load the counters"
        description="The field-activity KPIs didn't load. Check your connection and try again."
        onRetry={() => window.location.reload()}
      />
    );
  }

  return (
    <MetricCardsRow>
      {CARDS.map((card) =>
        isLoading || !summary ? (
          <Skeleton key={card.key} className={`h-32 ${CARD_WIDTH}`} />
        ) : (
          <StatCard
            key={card.key}
            className={CARD_WIDTH}
            label={card.label}
            value={numberFormat.format(summary[card.key])}
            caption={card.caption}
            tone={card.tone}
            icon={card.icon}
          />
        ),
      )}
    </MetricCardsRow>
  );
}
