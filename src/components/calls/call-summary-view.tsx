"use client";

import { useEffect, useState } from "react";
import {
  IconArrowDownRight,
  IconArrowUpRight,
  IconClock,
  IconClockHour4,
  IconPercentage,
  IconPhone,
  IconPhoneOutgoing,
  IconRefresh,
  type Icon,
} from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { cn } from "@/lib/cn";
import type { Tone } from "@/types";
import {
  fetchCallSummary,
  type CallKpi,
  type CallSummary,
} from "@/services/calls-service";
import { rangeFor, type PeriodId } from "./call-period-filter";

/**
 * The six KPI cards (CALL-03.1 → CALL-03.2). Order, per-card accent colour and
 * unit mirror the Workpex Summary carousel; the extra Inbound/Missed/Abandoned
 * cards and the ⓘ tooltips are deferred (approved Change Request). Each tone is
 * one of the six theme tokens, so no colour is inlined.
 */
type CardDef = {
  key: keyof CallSummary;
  label: string;
  tone: Tone;
  icon: Icon;
  unit?: string;
  decimals?: number;
};

const CARDS: CardDef[] = [
  { key: "totalCalls", label: "Total Calls", tone: "warning", icon: IconRefresh },
  { key: "uniqueCalls", label: "Unique Calls", tone: "danger", icon: IconPhone },
  {
    key: "totalCallMinutes",
    label: "Total Call Minutes",
    tone: "info",
    icon: IconClock,
    unit: "Min",
    decimals: 2,
  },
  {
    key: "averageCallTime",
    label: "Average Call Time",
    tone: "brand",
    icon: IconClockHour4,
    unit: "Min",
    decimals: 2,
  },
  {
    key: "callConnectPct",
    label: "Call Connect %",
    tone: "success",
    icon: IconPercentage,
    unit: "%",
    decimals: 2,
  },
  {
    key: "outboundCalls",
    label: "Outbound Calls",
    tone: "neutral",
    icon: IconPhoneOutgoing,
  },
];

/** The coloured day-over-day delta (AC2, AC4). */
function Delta({ kpi, period }: { kpi: CallKpi; period: PeriodId }) {
  const suffix = period === "today" ? "vs yesterday" : "vs previous period";
  if (kpi.changePct === null || kpi.changePct === 0) {
    return <span className="text-ink-muted">No Change</span>;
  }
  const up = kpi.changePct > 0;
  const Arrow = up ? IconArrowUpRight : IconArrowDownRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1",
        up ? "text-success" : "text-danger",
      )}
    >
      <Arrow size={14} stroke={2} aria-hidden="true" />
      {up ? "+" : ""}
      {kpi.changePct}% {suffix}
    </span>
  );
}

function formatValue(kpi: CallKpi, decimals?: number): string {
  return decimals ? kpi.value.toFixed(decimals) : String(kpi.value);
}

function SummaryCardsSkeleton() {
  return (
    <MetricCardsRow>
      {CARDS.map((card) => (
        <Skeleton
          key={card.key}
          className="h-[116px] w-[280px] shrink-0 rounded-surface"
        />
      ))}
    </MetricCardsRow>
  );
}

/**
 * The six KPI cards (CALL-03.2), fetched for the period the parent's Filter
 * selects. Tags each result with the period it answers so a slow earlier
 * response cannot repaint a newer selection (the lead-detail read rule). The
 * "Summary" header and the Filter live in the parent so the leaderboard shares
 * the one period.
 */
export function CallSummaryCards({ period }: { period: PeriodId }) {
  const [loaded, setLoaded] = useState<{
    period: PeriodId;
    data: CallSummary;
  } | null>(null);
  const [failed, setFailed] = useState<PeriodId | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallSummary(rangeFor(period), controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ period, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError") return;
        setFailed(period);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [period, reloadToken]);

  const data = loaded?.period === period ? loaded.data : null;
  const isError = failed === period;
  const isLoading = !data && !isError;

  if (isLoading) return <SummaryCardsSkeleton />;

  if (isError || !data) {
    return (
      <ErrorState
        title="Couldn’t load call summary"
        description="Something went wrong loading the call KPIs. Check your connection and try again."
        onRetry={() => {
          setFailed(null);
          setReloadToken((token) => token + 1);
        }}
      />
    );
  }

  return (
    <MetricCardsRow>
      {CARDS.map((card) => {
        const kpi = data[card.key];
        return (
          <StatCard
            key={card.key}
            label={card.label}
            value={formatValue(kpi, card.decimals)}
            unit={card.unit}
            tone={card.tone}
            icon={card.icon}
            caption={<Delta kpi={kpi} period={period} />}
            className="w-[280px]"
          />
        );
      })}
    </MetricCardsRow>
  );
}
