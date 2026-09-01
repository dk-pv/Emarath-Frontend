"use client";

import { useRef } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import {
  IconChecklist,
  IconCircleArrowDown,
  IconCircleArrowUp,
  IconCurrentLocation,
  IconMapPin,
  type Icon,
} from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { cn } from "@/lib/cn";
import { StatCard, type StatCardTone } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useGpsSummary } from "@/hooks/use-gps-summary";
import type { GpsSummaryRecord } from "@/services/gps-service";
import type { ListQuery } from "@/types";

/**
 * The five field-activity counters at the top of the GPS Map screen (GPS-04.2),
 * per ui-reference/gps-map/gps-map-map-view-zero-state-no-markers.png and
 * GPS-MAP-overview.mp4. The reference's five accents are orange / pink / blue /
 * purple / green; `pink` and `violet` are StatCard's own accents, added because the
 * semantic tone set has no member for either and mapping them to danger-red and
 * brand-green made two cards read wrong and collide with the green fifth card.
 */
const CARDS: {
  key: keyof GpsSummaryRecord;
  label: string;
  caption: string;
  tone: StatCardTone;
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
    tone: "pink",
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
    tone: "violet",
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

/** 374px — the reference card width measured at its native 1920 viewport. */
const CARD_WIDTH = "w-[23.375rem]";

const ARROWS = [
  {
    direction: -1 as const,
    label: "Scroll counters left",
    Glyph: IconChevronLeft,
    position: "-left-3",
  },
  {
    direction: 1 as const,
    label: "Scroll counters right",
    Glyph: IconChevronRight,
    position: "-right-3",
  },
];
const numberFormat = new Intl.NumberFormat("en-US");

export function GpsKpiCards({
  query,
  reloadToken,
}: {
  query: ListQuery;
  reloadToken: number;
}) {
  const { summary, isLoading, isError } = useGpsSummary(query, reloadToken);
  const rowRef = useRef<HTMLDivElement>(null);

  // The five cards are wider than the row, so the reference pages them with a chevron
  // at each edge rather than showing a scrollbar. One card plus its gap per press.
  const page = (direction: -1 | 1) =>
    rowRef.current?.scrollBy({
      left: direction * (374 + 39),
      behavior: "smooth",
    });

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
    <div className="relative">
      {/* gap-[39px]: the reference's card gap, measured on the same frame as the width. */}
      <MetricCardsRow ref={rowRef} hideScrollbar className="gap-[39px]">
        {CARDS.map((card) =>
          isLoading || !summary ? (
            <Skeleton key={card.key} className={`h-[8.25rem] ${CARD_WIDTH}`} />
          ) : (
            <StatCard
              key={card.key}
              variant="field"
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

      {ARROWS.map(({ direction, label, Glyph, position }) => (
        <button
          key={label}
          type="button"
          aria-label={label}
          onClick={() => page(direction)}
          className={cn(
            "focus-ring absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full border border-hairline bg-surface text-ink-muted shadow-md transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink",
            position,
          )}
        >
          <Glyph size={18} stroke={2} aria-hidden="true" />
        </button>
      ))}
    </div>
  );
}
