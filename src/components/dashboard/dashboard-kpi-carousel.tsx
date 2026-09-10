"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { cn } from "@/lib/cn";
import { formatAED } from "@/lib/format";
import { isAbortError } from "@/lib/api-client";
import {
  isPeriodId,
  periodKey,
  resolvePeriodRange,
} from "@/lib/dashboard-period";
import {
  fetchDashboardKpis,
  type DashboardKpis,
} from "@/services/dashboard-service";
import { DashboardKpiCard } from "./dashboard-kpi-card";
import {
  DASHBOARD_KPI_CARDS,
  KPI_SLOT_ACCENTS,
  type DashboardKpiCardDef,
} from "./dashboard-kpi-cards";

/** 284px card + 24px gap — the reference's 315/27 at the product's density. */
const CARD_PITCH = 308;

/**
 * Counts carry no thousands separator: the reference renders 4577, 3101 and 1579 —
 * see dashboard-kpi-carousel-cards-9-13.png and …cards-13-17.png. Only Converted
 * Amount is grouped, and that is `formatAED`'s job.
 */
const COUNT_FORMAT = new Intl.NumberFormat("en-US", { useGrouping: false });

/**
 * A counter's display value, or `null` when the card has nothing honest to show.
 *
 * Three different situations land on `null` and all mean the same thing to a reader:
 * the API does not implement this counter yet, it implements it but reports
 * `pending-definition` (Qualified Leads), or the request failed. A real zero is a
 * value, never a blank — `0` and `0.00 د.إ` are what the reference renders.
 */
function displayValue(
  card: DashboardKpiCardDef,
  kpis: DashboardKpis,
): string | null {
  const counter = kpis[card.counter];
  if (!counter || counter.value === null || counter.value === undefined) {
    return null;
  }
  if (card.format === "currency") return formatAED(counter.value);
  const count = Number(counter.value);
  return Number.isFinite(count) ? COUNT_FORMAT.format(count) : null;
}

/** Reserves the carousel's exact height so nothing below it moves as the counters land. */
export function DashboardKpiCarouselSkeleton() {
  return (
    <MetricCardsRow hideScrollbar className="gap-6">
      {DASHBOARD_KPI_CARDS.slice(0, 6).map((card) => (
        <Skeleton key={card.counter} className="h-29 w-71 rounded-surface" />
      ))}
    </MetricCardsRow>
  );
}

/**
 * The Workpex Dashboard's top KPI carousel (DASH-02.2).
 *
 * **A carousel, not a grid.** The nineteen cards keep their width and scroll sideways;
 * they never wrap and never widen the page, because MetricCardsRow is the element that
 * scrolls and the cards inside it do not shrink. A chevron sits over each edge and
 * pages by exactly one card, and — as the reference does — each one is absent rather
 * than greyed at the end it belongs to: dashboard-home-default-top.png shows only the
 * right chevron, the cards-15-19-end capture only the left, and the middle captures
 * show both.
 *
 * **Period.** The cards read the Dashboard control row's own period chip from the URL,
 * which is how Workpex draws it — the KPI row carries no per-card filter in any
 * capture, only the page chip above it. No new state is introduced for it: the URL
 * already holds the selection, and the two team widgets keep their own independent
 * periods untouched (DASH-01.2).
 *
 * **Scoping is the API's.** Every counter is scoped in the query by role, so an agent's
 * figures can only ever be their own; nothing is filtered here. The row's Sales Agent
 * selection is *not* applied — the KPI endpoint takes no owner argument, and filtering
 * by agent in the browser would be exactly the client-side scoping the project forbids.
 */
export function DashboardKpiCarousel() {
  const params = useSearchParams();
  const rowRef = useRef<HTMLDivElement>(null);

  const periodParam = params.get("period");
  const period = isPeriodId(periodParam) ? periodParam : "this-month";
  const range = useMemo(() => resolvePeriodRange(period), [period]);
  const key = periodKey(period, range);

  const [retryToken, setRetryToken] = useState(0);
  const [loaded, setLoaded] = useState<{
    key: string;
    kpis: DashboardKpis;
  } | null>(null);
  const [failed, setFailed] = useState<string | null>(null);

  // A result is tagged with the request it answers, so a slow earlier response can
  // never repaint a newer period — and the effect never has to reset state on its way
  // in, which is what would cascade a render. The same rule every Dashboard read uses.
  useEffect(() => {
    const controller = new AbortController();
    let active = true;

    fetchDashboardKpis(range, controller.signal)
      .then((kpis) => {
        if (!active) return;
        setLoaded({ key, kpis });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        // One failed read leaves the rest of the Dashboard alone: the cards fall back
        // to their unavailable state and the widgets below keep their own data.
        console.error("Dashboard KPI counters failed to load", error);
        setFailed(key);
      });

    return () => {
      active = false;
      controller.abort();
    };
  }, [key, range, retryToken]);

  const kpis = loaded?.key === key ? loaded.kpis : null;
  const isError = failed === key;
  const isLoading = kpis === null && !isError;

  // Which chevrons to draw. Recomputed on scroll and on resize, so the right one
  // disappears by itself once a wide viewport fits every card.
  const [edges, setEdges] = useState({ atStart: true, atEnd: true });
  const syncEdges = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    const max = row.scrollWidth - row.clientWidth;
    setEdges({
      atStart: row.scrollLeft <= 1,
      atEnd: row.scrollLeft >= max - 1,
    });
  }, []);

  useEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    syncEdges();
    row.addEventListener("scroll", syncEdges, { passive: true });
    const observer = new ResizeObserver(syncEdges);
    observer.observe(row);
    return () => {
      row.removeEventListener("scroll", syncEdges);
      observer.disconnect();
    };
  }, [syncEdges]);

  const page = (direction: -1 | 1) =>
    rowRef.current?.scrollBy({
      left: direction * CARD_PITCH,
      behavior: "smooth",
    });

  return (
    <div className="flex flex-col gap-2">
      {isError && (
        <p className="text-xs text-ink-muted">
          The counters couldn&rsquo;t be loaded.{" "}
          <button
            type="button"
            onClick={() => {
              setFailed(null);
              setRetryToken((token) => token + 1);
            }}
            className="focus-ring rounded-control font-medium text-ink underline"
          >
            Try again
          </button>
        </p>
      )}

      <div className="relative">
        <MetricCardsRow ref={rowRef} hideScrollbar className="gap-6">
          {DASHBOARD_KPI_CARDS.map((card, slot) => {
            const value = kpis === null ? null : displayValue(card, kpis);
            return (
              <DashboardKpiCard
                key={card.counter}
                title={card.title}
                description={card.description}
                icon={card.icon}
                accent={KPI_SLOT_ACCENTS[slot]}
              >
                {isLoading ? (
                  <Skeleton className="h-6.5 w-24" />
                ) : value === null ? (
                  <span className="text-base font-medium text-ink-subtle">
                    Unavailable
                  </span>
                ) : (
                  value
                )}
              </DashboardKpiCard>
            );
          })}
        </MetricCardsRow>

        {!edges.atStart && (
          <CarouselArrow
            label="Show previous counters"
            onClick={() => page(-1)}
            className="left-2"
            glyph={IconChevronLeft}
          />
        )}
        {!edges.atEnd && (
          <CarouselArrow
            label="Show next counters"
            onClick={() => page(1)}
            className="right-2"
            glyph={IconChevronRight}
          />
        )}
      </div>
    </div>
  );
}

/** The reference's chevron: a white 32px disc floating over the carousel's own edge. */
function CarouselArrow({
  label,
  onClick,
  className,
  glyph: Glyph,
}: {
  label: string;
  onClick: () => void;
  className: string;
  glyph: typeof IconChevronLeft;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className={cn(
        "focus-ring absolute top-1/2 z-10 flex size-8 -translate-y-1/2 items-center justify-center rounded-full bg-surface text-ink-muted shadow-md transition-colors duration-(--duration-shell) ease-shell hover:text-ink",
        className,
      )}
    >
      <Glyph size={18} stroke={2} aria-hidden="true" />
    </button>
  );
}
