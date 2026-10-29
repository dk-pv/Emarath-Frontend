"use client";

import { useEffect, useState } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatStrip, type StatStripItem } from "@/components/ui/StatStrip";
import { LOGISTICS_STATUS_TONE } from "@/components/logistics/logistics-status-badge";
import { isAbortError } from "@/lib/api-client";
import {
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  formatDateOnly,
  logisticsFilterParams,
  weekdayOf,
  type LogisticsFilters,
  type LogisticsStatus,
  type LogisticsSummary,
  type RegionCount,
} from "@/lib/logistics-orders";
import { fetchLogisticsSummary } from "@/services/logistics-service";

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

const NOT_IN_FILTER = "Not in the Status filter";

const orders = (count: number) =>
  `${count.toLocaleString("en-AE")} ${count === 1 ? "order" : "orders"}`;

/**
 * The Logistics dashboard's counts (client specification §10) on every view: a cell for every
 * status, in the order an order moves through them. Database counts from
 * `GET /logistics/orders/summary` under the caller's scope and every filter of the screen, so the
 * cells add up to the List's total and each is its Pipeline column's count. A status the Status
 * filter leaves out keeps its cell, greyed with "—": the filter excludes it, which a 0 would misstate.
 *
 * On the List and the Pipeline (`onFilter`) the cells are the Status filter itself, led by All
 * orders: a status chooses it alone, choosing it again — or All — clears it. All reads "—" too while
 * a status is chosen, since every status is then no longer in view. On the Dashboard (`onChoose`) a
 * cell opens the List of the orders it counts instead; one out of the filter opens nothing.
 */
export function LogisticsSummaryCards({
  status,
  summary,
  isError,
  onRetry,
  onFilter,
  onChoose,
}: {
  /** The Status filter in force; empty is none. */
  status: readonly LogisticsStatus[];
  summary: LogisticsSummary | null;
  isError: boolean;
  onRetry: () => void;
  /** The List's and the Pipeline's: sets the Status filter. */
  onFilter?: (status: LogisticsStatus[]) => void;
  /** The Dashboard's: opens the List of one status's orders. */
  onChoose?: (status: LogisticsStatus) => void;
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
  if (!summary) {
    return <Skeleton className="h-[60px] w-full rounded-surface" />;
  }

  const filtered = status.length > 0;
  const cells: StatStripItem[] = LOGISTICS_STATUSES.map((each) => {
    const inFilter = !filtered || status.includes(each);
    const count = summary.counts[each];
    const label = LOGISTICS_STATUS_LABEL[each];
    const cell: StatStripItem = {
      key: each,
      label,
      value: inFilter ? count.toLocaleString("en-AE") : "—",
      tone: inFilter ? LOGISTICS_STATUS_TONE[each] : "neutral",
      muted: !inFilter,
      title: inFilter ? undefined : NOT_IN_FILTER,
    };
    if (onFilter) {
      const pressed = filtered && status.includes(each);
      return {
        ...cell,
        pressed,
        onClick: () => onFilter(pressed && status.length === 1 ? [] : [each]),
      };
    }
    if (onChoose && inFilter) {
      return {
        ...cell,
        ariaLabel: `${label}: ${orders(count)} — open the list`,
        onClick: () => onChoose(each),
      };
    }
    return cell;
  });

  return (
    <section aria-label="Order counts">
      <StatStrip
        label="Orders per status"
        items={
          onFilter
            ? [
                {
                  key: "ALL",
                  label: "All orders",
                  value: filtered ? "—" : summary.total.toLocaleString("en-AE"),
                  muted: filtered,
                  title: filtered ? "Clear the Status filter" : undefined,
                  pressed: !filtered,
                  onClick: () => onFilter([]),
                },
                ...cells,
              ]
            : cells
        }
      />
    </section>
  );
}

/**
 * The line above the counts on every view: how many orders the filters match, and the business
 * day that Today and Overdue are measured on — the business timezone's, which may not be this
 * browser's. On the List and the Pipeline those orders follow per country and per city, most first
 * and none recorded last; the Dashboard has its own region cards instead. Nothing while the counts
 * have failed: the counts' own message says so.
 */
export function LogisticsMatchingOrders({
  summary,
  isError,
  regions = true,
}: {
  summary: LogisticsSummary | null;
  isError: boolean;
  regions?: boolean;
}) {
  if (!summary) {
    return isError ? null : <Skeleton className="h-5 w-72 max-w-full" />;
  }
  const { today, timeZone } = summary.businessDay;

  return (
    <section
      aria-label="Matching orders"
      className="flex min-w-0 flex-wrap items-center gap-x-5 gap-y-1.5 text-xs text-ink-muted"
    >
      <p>
        <span className="font-semibold text-ink">{orders(summary.total)}</span>{" "}
        · Business day {weekdayOf(today)} {formatDateOnly(today)} · {timeZone}
      </p>
      {regions && summary.total > 0 && (
        <>
          <RegionCounts label="Country" counts={summary.countries} />
          <RegionCounts label="City" counts={summary.cities} />
        </>
      )}
    </section>
  );
}

/** One region breakdown, scrolling sideways when it is longer than the line. */
function RegionCounts({
  label,
  counts,
}: {
  label: string;
  counts: readonly RegionCount[];
}) {
  return (
    <div className="flex max-w-full min-w-0 items-center gap-2">
      <span className="shrink-0 font-medium">{label}</span>
      <ul
        aria-label={`Orders by ${label.toLowerCase()}`}
        className="scrollbar-slim flex min-w-0 gap-1.5 overflow-x-auto"
      >
        {counts.map(({ value, count }) => (
          <li
            key={value ?? ""}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-hairline bg-surface px-2 py-px"
          >
            <span className={value === null ? "text-ink-muted" : "text-ink"}>
              {value ?? "Not set"}
            </span>
            <span className="font-semibold text-ink tabular-nums">
              {count.toLocaleString("en-AE")}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
