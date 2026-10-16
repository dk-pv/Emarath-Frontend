"use client";

import { useEffect, useState } from "react";
import {
  IconCircleX,
  IconClockHour4,
  IconPackage,
  IconShieldCheck,
  IconShieldX,
  IconTruckDelivery,
  IconTruckReturn,
  type Icon,
} from "@tabler/icons-react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatCard } from "@/components/ui/StatCard";
import { LOGISTICS_STATUS_TONE } from "@/components/logistics/logistics-status-badge";
import { isAbortError } from "@/lib/api-client";
import {
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  formatDateOnly,
  logisticsFilterParams,
  type LogisticsFilters,
  type LogisticsStatus,
  type LogisticsSummary,
  type RegionCount,
} from "@/lib/logistics-orders";
import { fetchLogisticsSummary } from "@/services/logistics-service";

/** One card per status, in the order an order moves through them. */
const ICONS: Record<LogisticsStatus, Icon> = {
  INITIAL: IconClockHour4,
  QC_VERIFIED: IconShieldCheck,
  QC_REJECTED: IconShieldX,
  DISPATCHED: IconTruckDelivery,
  DELIVERED: IconPackage,
  CANCELLED: IconCircleX,
  RTO: IconTruckReturn,
};

/**
 * The counts for `filters`, re-read whenever `reloadToken` moves (after an order action). The
 * last counts stay on screen while a newer read is in flight, so they never blank between two
 * reads; a failure only shows when there is nothing to show instead.
 */
export function useLogisticsSummary(
  filters: LogisticsFilters,
  reloadToken: number,
) {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${reloadToken}:${retryToken}:${logisticsFilterParams(filters)}`;
  const [loaded, setLoaded] = useState<LogisticsSummary | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchLogisticsSummary(filters, controller.signal)
      .then((summary) => {
        setLoaded(summary);
        setFailedKey(null);
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) setFailedKey(key);
      });
    return () => controller.abort();
  }, [key, filters]);

  return {
    summary: loaded,
    isError: failedKey === key,
    retry: () => setRetryToken((token) => token + 1),
  };
}

/**
 * The Logistics dashboard's counts (client specification §10) above both views: a card for every
 * status, then the total and the orders per country and per city. Database counts from
 * `GET /logistics/orders/summary` under the caller's scope and every filter of the screen, so the
 * cards' numbers add up to the total — the List's own — each is its Pipeline column's count, and
 * each region row adds up to the total too. A status the Status filter (or tab) leaves out keeps
 * its card, greyed with "—": the filter excludes it, which a 0 would misstate.
 */
export function LogisticsSummaryCards({
  status,
  summary,
  isError,
  onRetry,
}: {
  /** The Status filter: the statuses it leaves out read "Not in filter"; empty is none. */
  status: readonly LogisticsStatus[];
  summary: LogisticsSummary | null;
  isError: boolean;
  onRetry: () => void;
}) {
  if (!summary && isError) {
    return (
      <p role="alert" className="text-sm text-ink-muted">
        Couldn’t load the order counts.{" "}
        <button
          type="button"
          onClick={onRetry}
          className="focus-ring rounded-control text-brand-strong underline"
        >
          Try again
        </button>
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      <section aria-label="Order counts">
        <MetricCardsRow>
          {LOGISTICS_STATUSES.map((each) => {
            if (!summary) {
              return (
                <Skeleton
                  key={each}
                  className="h-[78px] min-w-[150px] flex-1 rounded-surface"
                />
              );
            }
            const inFilter = status.length === 0 || status.includes(each);
            return (
              <StatCard
                key={each}
                label={LOGISTICS_STATUS_LABEL[each]}
                value={
                  inFilter ? summary.counts[each].toLocaleString("en-AE") : "—"
                }
                caption={inFilter ? undefined : "Not in filter"}
                tone={inFilter ? LOGISTICS_STATUS_TONE[each] : "neutral"}
                icon={ICONS[each]}
                className="min-w-[150px] flex-1"
              />
            );
          })}
        </MetricCardsRow>
      </section>

      {!summary ? (
        <Skeleton className="h-12 w-full rounded-surface" />
      ) : (
        summary.total > 0 && (
          <section aria-label="Matching orders" className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-medium text-ink-muted">
                Total
              </span>
              <span className="rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs font-semibold text-ink">
                {summary.total.toLocaleString("en-AE")}{" "}
                {summary.total === 1 ? "order" : "orders"}
              </span>
              {/* The day "Today" means for the delivery buckets — the business timezone's,
                  which may not be this browser's. */}
              <span className="text-xs text-ink-muted">
                Business day {formatDateOnly(summary.businessDay.today)} ·{" "}
                {summary.businessDay.timeZone}
              </span>
            </div>
            <RegionCounts label="Country" counts={summary.countries} />
            <RegionCounts label="City" counts={summary.cities} />
          </section>
        )
      )}
    </div>
  );
}

/**
 * One region breakdown on a single line — most orders first, those with none recorded last —
 * scrolling sideways when it is longer than the screen.
 */
function RegionCounts({
  label,
  counts,
}: {
  label: string;
  counts: readonly RegionCount[];
}) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="w-14 shrink-0 text-xs font-medium text-ink-muted">
        {label}
      </span>
      <ul
        aria-label={`Orders by ${label.toLowerCase()}`}
        className="scrollbar-slim flex min-w-0 gap-1.5 overflow-x-auto pb-1"
      >
        {counts.map(({ value, count }) => (
          <li
            key={value ?? ""}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2.5 py-0.5 text-xs"
          >
            <span className={value === null ? "text-ink-muted" : "text-ink"}>
              {value ?? "Not set"}
            </span>
            <span className="font-semibold text-ink">
              {count.toLocaleString("en-AE")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
