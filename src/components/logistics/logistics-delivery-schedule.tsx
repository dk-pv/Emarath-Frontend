"use client";

import { useEffect, useRef, useState } from "react";
import { DatePicker } from "@/components/ui/DatePicker";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatStrip } from "@/components/ui/StatStrip";
import { DELIVERY_BUCKET_TONE } from "@/components/logistics/logistics-delivery-date";
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
 *
 * The buckets are the cells of one card and the days its footer, since both set the same filter.
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
    return <Skeleton className="h-[110px] w-full rounded-surface" />;
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
    <section aria-label="Delivery schedule" className="flex flex-col gap-1.5">
      <StatStrip
        label="Orders by delivery bucket"
        items={BUCKETS.map((bucket) => {
          const breakdown =
            bucket === "tomorrow"
              ? statusBreakdown(days.find((each) => each.date === day.tomorrow))
              : "";
          return {
            key: bucket,
            label:
              bucket === "tomorrow"
                ? "Tomorrow’s Deliveries"
                : DELIVERY_BUCKET_LABEL[bucket],
            value: buckets[bucket].toLocaleString("en-AE"),
            caption: breakdown || bucketCaption(bucket, day),
            tone: DELIVERY_BUCKET_TONE[bucket],
            // The one bucket someone must act on is washed, and only while it holds orders.
            highlight: bucket === "overdue" && buckets.overdue > 0,
            pressed: isDeliveryChoice(choice, bucketChoice(bucket)),
            onClick: () => toggle(bucketChoice(bucket)),
          };
        })}
        footer={
          // On a phone the chips take a line of their own, under the label and the picker.
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-3.5 py-2">
            <span className="text-xs font-medium text-ink-muted">By day</span>
            <div
              role="group"
              aria-label="Orders by delivery day"
              className="scrollbar-slim order-last flex min-w-0 basis-full gap-1.5 overflow-x-auto pb-1 sm:order-none sm:flex-1 sm:basis-0"
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
                      "focus-ring flex h-7 shrink-0 items-center gap-1.5 rounded-control border pr-1 pl-2.5 text-xs transition-colors duration-(--duration-shell) ease-shell",
                      chosen
                        ? "border-brand bg-brand text-white"
                        : "border-hairline bg-surface text-ink-soft hover:bg-canvas",
                    )}
                  >
                    {label}
                    {/* A day with orders stands out from the empty ones around it. */}
                    <span
                      className={cn(
                        "min-w-5 rounded-[5px] px-1 text-center text-[11px] leading-4 font-semibold tabular-nums",
                        chosen
                          ? "bg-white/25 text-white"
                          : total > 0
                            ? "bg-hairline/60 text-ink"
                            : "text-ink-muted",
                      )}
                    >
                      {total.toLocaleString("en-AE")}
                    </span>
                  </button>
                );
              })}
            </div>
            {/* Any day, beyond the two weeks too: a calendar day, kept as its YYYY-MM-DD parts and
                never converted to an instant, so no timezone can move it. Its trigger takes the
                chips' height, so the row is no taller than they are. */}
            <DatePicker
              numeric
              className="ml-auto w-36 shrink-0 sm:ml-0 [&>button]:h-7"
              value={keyBound(picked).day}
              onChange={(date) =>
                onChoose(
                  date ? dayChoice(dateKey(date), day) : NO_DELIVERY_CHOICE,
                )
              }
              placeholder="Pick a date"
            />
          </div>
        }
      />

      {dated === 0 && (
        <p className="text-xs text-ink-muted">
          No order in these filters has a delivery date yet.
        </p>
      )}
    </section>
  );
}
