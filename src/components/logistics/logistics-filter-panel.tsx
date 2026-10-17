"use client";

import { useEffect, useMemo, useState } from "react";
import { FilterPanel } from "@/components/filters/filter-panel";
import {
  DELIVERY_BUCKETS,
  DELIVERY_BUCKET_LABEL,
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  formatDateOnly,
  weekdayOf,
  type BusinessDay,
  type DeliveryBucket,
  type LogisticsAssigneeOption,
  type LogisticsFilterOptions,
  type LogisticsStatus,
} from "@/lib/logistics-orders";
import { fetchLogisticsFilterOptions } from "@/services/logistics-service";
import type { FilterField } from "@/types";

export type LogisticsChosenFilters = {
  status: LogisticsStatus[];
  delivery: DeliveryBucket[];
  deliveryOn: string | null;
  country: string[];
  city: string[];
  state: string[];
  courier: string[];
  assignedAgent: string[];
};

/** The multi-value filters each read and written under their own key. */
type ValueKey = "country" | "city" | "state" | "courier" | "assignedAgent";
const VALUE_KEYS: readonly string[] = [
  "country",
  "city",
  "state",
  "courier",
  "assignedAgent",
] satisfies readonly ValueKey[];

/** The Delivery Date field's value for a chosen day — one more choice beside the buckets. */
const onDay = (date: string) => `on:${date}`;

/**
 * The delivery buckets, Today and Tomorrow carrying the business days the API measured them
 * against — its business timezone's, not this browser's — then the day chosen on the schedule, if
 * any, so it shows and can be removed here like every other filter value.
 */
function deliveryOptions(day: BusinessDay | undefined, on: string | null) {
  const buckets = DELIVERY_BUCKETS.map((bucket) => {
    const date =
      bucket === "today"
        ? day?.today
        : bucket === "tomorrow"
          ? day?.tomorrow
          : undefined;
    const label = DELIVERY_BUCKET_LABEL[bucket];
    return {
      value: bucket,
      label: date ? `${label} · ${formatDateOnly(date)}` : label,
    };
  });
  return on
    ? [
        ...buckets,
        {
          value: onDay(on),
          label: `On ${weekdayOf(on)} ${formatDateOnly(on)}`,
        },
      ]
    : buckets;
}

const STATUS_OPTIONS = LOGISTICS_STATUSES.map((status) => ({
  value: status,
  label: LOGISTICS_STATUS_LABEL[status],
}));

/**
 * The values offered, then any chosen value the caller's orders no longer hold — one arriving
 * in a shared link — so every filter in force shows, and can be removed, in the panel.
 */
function choices(offered: readonly string[], chosen: readonly string[]) {
  return [
    ...offered,
    ...chosen.filter((value) => !offered.includes(value)),
  ].map((value) => ({ value, label: value }));
}

/**
 * The sales executives offered, by name, then any chosen id the options no longer hold — named
 * as such so it still shows, and can be removed, in the panel.
 */
function assigneeChoices(
  offered: readonly LogisticsAssigneeOption[],
  chosen: readonly string[],
) {
  return [
    ...offered.map(({ id, name }) => ({ value: id, label: name })),
    ...chosen
      .filter((id) => !offered.some((option) => option.id === id))
      .map((id) => ({ value: id, label: "Unknown user" })),
  ];
}

/**
 * The values in the caller's own orders, read again after an order action (an edit can bring a
 * new city, a dispatch a new delivery partner). Non-critical: if they can't be read, the filters still apply and
 * the dropdowns offer only what is already chosen.
 */
function useFilterOptions(reloadToken: number) {
  const [options, setOptions] = useState<LogisticsFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchLogisticsFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {});
    return () => controller.abort();
  }, [reloadToken]);
  return options;
}

/**
 * The Logistics screen's Filter control: the shared filter popover (FND-03.2) with Status,
 * Delivery Date, Country, City, State / Area, Delivery Partner and Sales Executive, each taking
 * any number of values. A change applies at once and
 * is written to the address by the screen, which takes the List, the Pipeline and the counts with
 * it.
 */
export function LogisticsFilterPanel({
  value,
  businessDay,
  reloadToken,
  onChange,
  onClear,
}: {
  value: LogisticsChosenFilters;
  /** The business day from the counts, to date the Today and Tomorrow choices. */
  businessDay?: BusinessDay;
  reloadToken: number;
  onChange: (changes: Partial<LogisticsChosenFilters>) => void;
  onClear: () => void;
}) {
  const options = useFilterOptions(reloadToken);
  const fields = useMemo<FilterField[]>(
    () => [
      {
        key: "status",
        label: "Status",
        type: "multi",
        options: STATUS_OPTIONS,
      },
      {
        key: "delivery",
        label: "Delivery Date",
        type: "multi",
        options: deliveryOptions(businessDay, value.deliveryOn),
      },
      {
        key: "country",
        label: "Country",
        type: "multi",
        searchable: true,
        options: choices(options?.countries ?? [], value.country),
      },
      {
        key: "city",
        label: "City",
        type: "multi",
        searchable: true,
        options: choices(options?.cities ?? [], value.city),
      },
      {
        key: "state",
        label: "State / Area",
        type: "multi",
        searchable: true,
        options: choices(options?.states ?? [], value.state),
      },
      {
        key: "courier",
        label: "Delivery Partner",
        type: "multi",
        searchable: true,
        options: choices(options?.couriers ?? [], value.courier),
      },
      {
        key: "assignedAgent",
        label: "Sales Executive",
        type: "multi",
        searchable: true,
        options: assigneeChoices(options?.assignees ?? [], value.assignedAgent),
      },
    ],
    [
      options,
      businessDay,
      value.deliveryOn,
      value.country,
      value.city,
      value.state,
      value.courier,
      value.assignedAgent,
    ],
  );
  const delivery = value.deliveryOn
    ? [...value.delivery, onDay(value.deliveryOn)]
    : value.delivery;

  return (
    <FilterPanel
      title="Filters"
      fields={fields}
      activeCount={
        [
          value.status,
          delivery,
          value.country,
          value.city,
          value.state,
          value.courier,
          value.assignedAgent,
        ].filter((chosen) => chosen.length > 0).length
      }
      valueOf={(key) =>
        key === "status"
          ? value.status
          : key === "delivery"
            ? delivery
            : VALUE_KEYS.includes(key)
              ? value[key as ValueKey]
              : []
      }
      onChange={(key, next) => {
        const values = Array.isArray(next) ? next : [];
        if (key === "status") {
          onChange({
            status: LOGISTICS_STATUSES.filter((status) =>
              values.includes(status),
            ),
          });
        } else if (key === "delivery") {
          onChange({
            delivery: DELIVERY_BUCKETS.filter((bucket) =>
              values.includes(bucket),
            ),
            deliveryOn:
              value.deliveryOn && values.includes(onDay(value.deliveryOn))
                ? value.deliveryOn
                : null,
          });
        } else if (VALUE_KEYS.includes(key)) {
          onChange({ [key as ValueKey]: values });
        }
      }}
      onClear={onClear}
    />
  );
}
