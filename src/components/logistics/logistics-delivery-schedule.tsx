"use client";

import { useEffect, useRef, useState } from "react";
import { MetricCardsRow } from "@/components/layout/MetricCardsRow";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { isAbortError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { dateKey, keyBound } from "@/lib/date-time-range";
import {
  DELIVERY_BUCKET_LABEL,
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  NO_DELIVERY_CHOICE,
  bucketChoice,
  dayChoice,
  dayIn,
  formatDateOnly,
  isDeliveryChoice,
  logisticsFilterParams,
  readLogisticsFilters,
  scheduleFilters,
  weekdayOf,
  type BusinessDay,
  type DeliveryBucket,
  type DeliveryChoice,
  type DeliveryScheduleDay,
  type LogisticsDeliverySchedule as Schedule,
  type LogisticsFilters,
} from "@/lib/logistics-orders";
import { fetchLogisticsDeliverySchedule } from "@/services/logistics-service";

/**
 * The schedule for every filter but the delivery date's own — so choosing a bucket or a day reads
 * nothing again — re-read whenever `reloadToken` moves. Like the counts, the last schedule stays on
 * screen while a newer read is in flight, and a failure only shows when there is nothing to show.
 */
export function useDeliverySchedule(
  filters: LogisticsFilters,
  reloadToken: number,
) {
  const [retryToken, setRetryToken] = useState(0);
  const query = logisticsFilterParams(scheduleFilters(filters)).toString();
  const key = `${reloadToken}:${retryToken}:${query}`;
  const [loaded, setLoaded] = useState<Schedule | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchLogisticsDeliverySchedule(
      readLogisticsFilters(new URLSearchParams(query)),
      controller.signal,
    )
      .then((schedule) => {
        setLoaded(schedule);
        setFailedKey(null);
      })
      .catch((error: unknown) => {
        if (!isAbortError(error)) setFailedKey(key);
      });
    return () => controller.abort();
  }, [key, query]);

  return {
    schedule: loaded,
    isError: failedKey === key,
    retry: () => setRetryToken((token) => token + 1),
  };
}

/**
 * Calls `onNewDay` once when the business day turns over while the screen stays open — checked
 * each minute and whenever the window regains focus — so Today, Tomorrow and Overdue move on
 * without a reload. The day is read in the business timezone the API names, and the API still
 * decides every bucket. Only a change in the day read here counts, so a wrong local clock costs
 * one extra read a day, never a loop.
 */
export function useBusinessDayRollover(
  timeZone: string | undefined,
  onNewDay: () => void,
) {
  const callback = useRef(onNewDay);
  useEffect(() => {
    callback.current = onNewDay;
  });
  useEffect(() => {
    if (!timeZone) return;
    let seen = dayIn(timeZone);
    const check = () => {
      const now = dayIn(timeZone);
      if (now === seen) return;
      seen = now;
      callback.current();
    };
    const timer = window.setInterval(check, 60_000);
    window.addEventListener("focus", check);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", check);
    };
  }, [timeZone]);
}

/** The buckets in the order the work falls due; the tones are the delivery tag's (ADR-0094). */
const BUCKETS: readonly DeliveryBucket[] = [
  "overdue",
  "today",
  "tomorrow",
  "future",
  "none",
];
const TONE: Record<DeliveryBucket, string> = {
  overdue: "border-danger/40 bg-danger/10",
  today: "border-warning/40 bg-warning/10",
  tomorrow: "border-info/40 bg-info/10",
  future: "border-hairline bg-surface",
  none: "border-hairline bg-surface",
};

/** `Fri 16-10-2026` — a day as the schedule names it. */
const dayName = (date: string) => `${weekdayOf(date)} ${formatDateOnly(date)}`;

/** What a bucket's tile says under its name: the days it covers, measured on the business day. */
function bucketCaption(bucket: DeliveryBucket, day: BusinessDay): string {
  switch (bucket) {
    // Overdue leaves out cancelled and returned orders as well as delivered ones: still open.
    case "overdue":
      return `Before ${formatDateOnly(day.today)}, still open`;
    case "today":
      return dayName(day.today);
    case "tomorrow":
      return dayName(day.tomorrow);
    case "future":
      return `After ${formatDateOnly(day.tomorrow)}`;
    case "none":
      return "No date set";
  }
}

/** `2 QC Verified · 1 Dispatched` — a day's orders by status, in lifecycle order. */
function statusBreakdown(day: DeliveryScheduleDay | undefined): string {
  if (!day) return "";
  return LOGISTICS_STATUSES.filter((status) => day.counts[status] > 0)
    .map((status) => `${day.counts[status]} ${LOGISTICS_STATUS_LABEL[status]}`)
    .join(" · ");
}

/**
 * The delivery schedule above the counts, on the List and the Pipeline alike (client
 * requirements: "Tomorrow's Deliveries", date-wise counts, choosing a date): a tile per delivery
 * bucket and a chip per day for the coming two weeks, each counting the orders the screen's other
 * filters select. Choosing one sets the Delivery Date filter — the List, the Pipeline, the cards and
 * the region rows then show those orders — and choosing it again clears it. The schedule never
 * narrows itself by that choice, so the other days stay in view; each of its numbers is the List's
 * total once that bucket or day is chosen.
 */
export function LogisticsDeliverySchedule({
  choice,
  schedule,
  isError,
  onRetry,
  onChoose,
}: {
  /** The Delivery Date filter in force. */
  choice: DeliveryChoice;
  schedule: Schedule | null;
  isError: boolean;
  onRetry: () => void;
  onChoose: (choice: DeliveryChoice) => void;
}) {
  if (!schedule && isError) {
    return (
      <p role="alert" className="text-sm text-ink-muted">
        Couldn’t load the delivery schedule.{" "}
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
  if (!schedule) {
    return <Skeleton className="h-[106px] w-full rounded-surface" />;
  }

  const { businessDay: day, buckets, days } = schedule;
  // Choosing what is already chosen clears it, as a status tab does.
  const toggle = (next: DeliveryChoice) =>
    onChoose(isDeliveryChoice(choice, next) ? NO_DELIVERY_CHOICE : next);
  // The picker shows the day chosen, Today and Tomorrow included.
  const picked =
    choice.deliveryOn ??
    (isDeliveryChoice(choice, bucketChoice("today"))
      ? day.today
      : isDeliveryChoice(choice, bucketChoice("tomorrow"))
        ? day.tomorrow
        : null);
  const dated =
    buckets.overdue + buckets.today + buckets.tomorrow + buckets.future;

  return (
    <section aria-label="Delivery schedule" className="flex flex-col gap-2">
      <div role="group" aria-label="Orders by delivery bucket">
        <MetricCardsRow>
          {BUCKETS.map((bucket) => {
            const chosen = isDeliveryChoice(choice, bucketChoice(bucket));
            const breakdown =
              bucket === "tomorrow"
                ? statusBreakdown(
                    days.find((each) => each.date === day.tomorrow),
                  )
                : "";
            return (
              <button
                key={bucket}
                type="button"
                aria-pressed={chosen}
                onClick={() => toggle(bucketChoice(bucket))}
                className={cn(
                  "focus-ring flex min-w-[150px] flex-1 flex-col items-start gap-1 rounded-surface border px-3 py-2 text-left transition-colors duration-(--duration-shell) ease-shell hover:border-brand/60",
                  TONE[bucket],
                  chosen && "border-brand ring-2 ring-brand",
                )}
              >
                <span className="text-xs font-medium text-ink">
                  {bucket === "tomorrow"
                    ? "Tomorrow’s Deliveries"
                    : DELIVERY_BUCKET_LABEL[bucket]}
                </span>
                <span className="flex min-w-0 max-w-full items-baseline gap-2">
                  <span className="text-xl leading-none font-semibold text-ink">
                    {buckets[bucket].toLocaleString("en-AE")}
                  </span>
                  <span className="truncate text-xs text-ink-muted">
                    {breakdown || bucketCaption(bucket, day)}
                  </span>
                </span>
              </button>
            );
          })}
        </MetricCardsRow>
      </div>

      <div className="flex min-w-0 items-center gap-2">
        <span className="w-14 shrink-0 text-xs font-medium text-ink-muted">
          By day
        </span>
        <div
          role="group"
          aria-label="Orders by delivery day"
          className="scrollbar-slim flex min-w-0 flex-1 gap-1.5 overflow-x-auto pb-1"
        >
          {days.map(({ date, total }) => {
            const next = dayChoice(date, day);
            const chosen = isDeliveryChoice(choice, next);
            const label =
              date === day.today
                ? "Today"
                : date === day.tomorrow
                  ? "Tomorrow"
                  : `${weekdayOf(date)} ${formatDateOnly(date).slice(0, 5)}`;
            return (
              <button
                key={date}
                type="button"
                aria-pressed={chosen}
                aria-label={`${dayName(date)}: ${total} ${total === 1 ? "order" : "orders"}`}
                onClick={() => toggle(next)}
                className={cn(
                  "focus-ring flex shrink-0 items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs transition-colors duration-(--duration-shell) ease-shell",
                  chosen
                    ? "border-brand bg-brand text-white"
                    : "border-hairline bg-surface text-ink hover:bg-canvas",
                )}
              >
                <span className={chosen ? undefined : "text-ink-muted"}>
                  {label}
                </span>
                <span className="font-semibold">
                  {total.toLocaleString("en-AE")}
                </span>
              </button>
            );
          })}
        </div>
        {/* Any day, beyond the two weeks too: a calendar day, kept as its YYYY-MM-DD parts and
            never converted to an instant, so no timezone can move it. */}
        <DatePicker
          numeric
          className="w-36 shrink-0"
          value={keyBound(picked).day}
          onChange={(date) =>
            onChoose(date ? dayChoice(dateKey(date), day) : NO_DELIVERY_CHOICE)
          }
          placeholder="Pick a date"
        />
      </div>

      {dated === 0 && (
        <p className="text-xs text-ink-muted">
          No order in these filters has a delivery date yet.
        </p>
      )}
    </section>
  );
}
