import {
  IconClockHour4,
  IconCoin,
  IconFlame,
  IconPhoneCall,
  IconRefresh,
  type Icon,
} from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import type { SummaryCard } from "@/types";

/** Icon per card id, mirroring the Workpex KPI carousel. */
export const SUMMARY_ICONS: Record<string, Icon> = {
  overdue: IconRefresh,
  hot: IconFlame,
  today: IconPhoneCall,
  "today-follow": IconCoin,
  qualified: IconClockHour4,
};

export function SummaryCards({ cards }: { cards: readonly SummaryCard[] }) {
  return (
    <MetricCardsRow>
      {cards.map((card) => (
        <StatCard
          key={card.id}
          label={card.label}
          value={card.value}
          caption={card.caption}
          tone={card.tone}
          icon={SUMMARY_ICONS[card.id] ?? IconCoin}
        />
      ))}
    </MetricCardsRow>
  );
}

export function SummaryCardsSkeleton() {
  return (
    <MetricCardsRow>
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton
          key={i}
          className="h-[120px] w-[340px] shrink-0 rounded-surface"
        />
      ))}
    </MetricCardsRow>
  );
}
