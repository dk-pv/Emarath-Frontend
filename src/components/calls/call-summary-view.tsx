"use client";

import { useEffect, useMemo, useState } from "react";
import {
  IconClock,
  IconClockHour4,
  IconPercentage,
  IconPhone,
  IconPhoneCalling,
  IconPhoneIncoming,
  IconPhoneOff,
  IconPhoneOutgoing,
  IconPhonePause,
  IconRefresh,
  type Icon,
} from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { StatCard } from "@/components/ui/StatCard";
import { Skeleton } from "@/components/ui/Skeleton";
import { ErrorState } from "@/components/ui/ErrorState";
import { Tooltip } from "@/components/ui/Tooltip";
import type { Tone } from "@/types";
import {
  fetchCallSummary,
  type CallKpi,
  type CallSummary,
} from "@/services/calls-service";
import { resolveCallRange, type CallFilterState } from "./call-filter-panel";

/**
 * The Summary carousel. Order, unit and per-card accent mirror the Workpex
 * reference; the six CALL-03.1 backlog KPIs sit inside the eleven the reference
 * shows, in the reference's own order. Every tone is a theme token, so no colour
 * is inlined.
 *
 * `hint` is the card's ⓘ tooltip: it states the formula the API actually used,
 * so a metric whose definition was ruled rather than specified says so on the
 * card instead of only in a document.
 *
 * The cards carry a title, the ⓘ, the badge and the value — nothing else. The
 * reference shows no day-over-day delta, so none is rendered; the API still
 * returns `changePct` for callers that want it.
 */
type CardDef = {
  key: keyof CallSummary;
  label: string;
  tone: Tone;
  icon: Icon;
  hint: string;
  unit?: string;
  decimals?: number;
};

const CARDS: CardDef[] = [
  {
    key: "freshCalls",
    label: "Fresh Calls",
    tone: "info",
    icon: IconPhoneCalling,
    hint: "Contacts called for the first time in this period — a lead with no earlier call on record.",
  },
  {
    key: "followUpCallsCompleted",
    label: "Follow-up Calls Completed",
    tone: "danger",
    icon: IconPhoneOutgoing,
    hint: "Scheduled Call follow-ups marked complete in this period. Counted from Activities, not from the phone system.",
  },
  {
    key: "totalCalls",
    label: "Total Calls",
    tone: "warning",
    icon: IconRefresh,
    hint: "Every call attempt logged in this period, inbound and outbound.",
  },
  {
    key: "uniqueCalls",
    label: "Unique Calls",
    tone: "danger",
    icon: IconPhone,
    hint: "Distinct contacts called — three attempts on one lead count once.",
  },
  {
    key: "totalCallMinutes",
    label: "Total Call Minutes",
    tone: "info",
    icon: IconClock,
    unit: "Min",
    decimals: 2,
    hint: "Total talk time across every call in this period.",
  },
  {
    key: "averageCallTime",
    label: "Average Call Time",
    tone: "brand",
    icon: IconClockHour4,
    unit: "Min",
    decimals: 2,
    hint: "Total call minutes divided by answered calls — average time per connected call.",
  },
  {
    key: "callConnectPct",
    label: "Call Connect %",
    tone: "success",
    icon: IconPercentage,
    unit: "%",
    decimals: 2,
    hint: "Answered calls as a share of total calls.",
  },
  {
    key: "outboundCalls",
    label: "Outbound Calls",
    tone: "warning",
    icon: IconPhoneOutgoing,
    hint: "Calls placed by an agent.",
  },
  {
    key: "inboundCalls",
    label: "Inbound Calls",
    tone: "brand",
    icon: IconPhoneIncoming,
    hint: "Calls received from a contact.",
  },
  {
    key: "missedCalls",
    label: "Missed Calls",
    tone: "danger",
    icon: IconPhoneOff,
    hint: "Inbound calls that were not answered.",
  },
  {
    key: "abandonedCalls",
    label: "Abandoned Calls",
    tone: "neutral",
    icon: IconPhonePause,
    hint: "Missed inbound calls that never connected at all — the caller hung up before pickup.",
  },
];

function formatValue(kpi: CallKpi, decimals?: number): string {
  return decimals ? kpi.value.toFixed(decimals) : String(kpi.value);
}

/** Enough cards to fill a wide row, so the skeleton does not jump on load. */
function SummaryCardsSkeleton() {
  return (
    <MetricCardsRow hideScrollbar>
      {CARDS.slice(0, 6).map((card) => (
        <Skeleton
          key={card.key}
          className="h-[122px] w-[340px] max-w-full shrink-0 rounded-surface"
        />
      ))}
    </MetricCardsRow>
  );
}

/**
 * The Summary KPI carousel (CALL-03.2), fetched for whatever the dashboard's one
 * Filter selects. Tags each result with the request it answers so a slow earlier
 * response cannot repaint a newer selection.
 */
export function CallSummaryCards({ filters }: { filters: CallFilterState }) {
  const range = useMemo(() => resolveCallRange(filters), [filters]);
  const requestKey = `${range.from}|${range.to}|${range.agentId ?? ""}`;

  const [loaded, setLoaded] = useState<{
    key: string;
    data: CallSummary;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchCallSummary(range, controller.signal)
      .then((data) => {
        if (!active) return;
        setLoaded({ key: requestKey, data });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailed(requestKey);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [range, requestKey, reloadToken]);

  const data = loaded?.key === requestKey ? loaded.data : null;
  const isError = failed === requestKey;

  if (isError) {
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

  if (!data) return <SummaryCardsSkeleton />;

  return (
    <MetricCardsRow hideScrollbar>
      {CARDS.map((card) => {
        const kpi = data[card.key];
        return (
          <StatCard
            key={card.key}
            label={
              <span className="inline-flex items-center gap-1.5">
                {card.label}
                <Tooltip content={card.hint} tone="light" portal>
                  <span
                    tabIndex={0}
                    role="note"
                    aria-label={`${card.label}: ${card.hint}`}
                    className="focus-ring inline-flex size-3.5 shrink-0 items-center justify-center rounded-full border border-current text-[9px] leading-none text-ink-subtle"
                  >
                    i
                  </span>
                </Tooltip>
              </span>
            }
            value={formatValue(kpi, card.decimals)}
            unit={card.unit}
            tone={card.tone}
            icon={card.icon}
            variant="kpi"
            // 340px is the reference width; the row is only ~270px wide on a
            // phone, so the cap keeps a whole card readable there without
            // shrinking it anywhere it already fits.
            className="w-[340px] max-w-full"
          />
        );
      })}
    </MetricCardsRow>
  );
}
