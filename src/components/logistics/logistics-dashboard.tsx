"use client";

import { useEffect, useMemo, useState } from "react";
import { IconTruck } from "@tabler/icons-react";
import { Toolbar } from "@/components/layout/Toolbar";
import { ResponsiveTableContainer } from "@/components/layout/ResponsiveTableContainer";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { Table } from "@/components/ui/Table";
import { LogisticsDeliveryDate } from "@/components/logistics/logistics-delivery-date";
import { LogisticsDeliverySchedule } from "@/components/logistics/logistics-delivery-schedule";
import { LogisticsStatusBadge } from "@/components/logistics/logistics-status-badge";
import { LogisticsSummaryCards } from "@/components/logistics/logistics-summary-cards";
import { ApiError, isAbortError } from "@/lib/api-client";
import {
  barWidth,
  drillTo,
  isDashboardEmpty,
  shareOf,
  upcomingQuery,
  type AreaField,
  type DashboardDrill,
} from "@/lib/logistics-dashboard";
import {
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  dayChoice,
  formatDateOnly,
  orderNumberLabel,
  ordersLoadError,
  weekdayOf,
  type BusinessDay,
  type DeliveryScheduleDay,
  type LogisticsDeliverySchedule as Schedule,
  type LogisticsFilters,
  type LogisticsSummary,
  type LogisticsUrlState,
  type RegionCount,
} from "@/lib/logistics-orders";
import {
  fetchLogisticsOrders,
  type LogisticsOrder,
} from "@/services/logistics-service";
import type { TableColumn } from "@/types";

/** What `useLogisticsSummary` and `useDeliverySchedule` hand back. */
type Loaded<T> = { isError: boolean; retry: () => void } & T;

/**
 * The next deliveries under the screen's filters (`upcomingQuery`), read again after an order
 * action. The list endpoint itself, so its rows and total are the List's own.
 */
function useUpcomingDeliveries(filters: LogisticsFilters, reloadToken: number) {
  const query = useMemo(() => upcomingQuery(filters), [filters]);
  const [retryToken, setRetryToken] = useState(0);
  const key = `${reloadToken}:${retryToken}:${JSON.stringify(query)}`;
  const [loaded, setLoaded] = useState<{
    key: string;
    rows: LogisticsOrder[];
    total: number;
  } | null>(null);
  const [failed, setFailed] = useState<{ key: string; status?: number } | null>(
    null,
  );

  useEffect(() => {
    const controller = new AbortController();
    fetchLogisticsOrders(query, controller.signal)
      .then((result) => setLoaded({ key, ...result, rows: [...result.rows] }))
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        setFailed({
          key,
          status: error instanceof ApiError ? error.status : undefined,
        });
      });
    return () => controller.abort();
  }, [key, query]);

  return {
    loaded: loaded?.key === key ? loaded : null,
    error: failed?.key === key ? failed : null,
    retry: () => setRetryToken((token) => token + 1),
  };
}

/** `Thu 22-10-2026`, or Today / Tomorrow by name. */
function dayLabel(date: string, day: BusinessDay): string {
  const named =
    date === day.today
      ? "Today · "
      : date === day.tomorrow
        ? "Tomorrow · "
        : "";
  return `${named}${weekdayOf(date)} ${formatDateOnly(date)}`;
}

const zeroMuted = (count: number) =>
  count === 0 ? (
    <span className="text-ink-subtle">0</span>
  ) : (
    count.toLocaleString("en-AE")
  );

/**
 * Logistics Dashboard v1 (client specification §10 and the Logistics requirements): the caller's
 * orders as numbers — delivery-date buckets, a card per status, the coming two weeks day by day
 * with each day's statuses, the upcoming deliveries, and the orders per area, city and country.
 *
 * A view of the Logistics screen, beside List and Pipeline, under the same address, search and
 * filters: nothing here is counted in the browser. The status, area, city and country numbers are
 * `GET /logistics/orders/summary`; the buckets and days are `/delivery-schedule`, which leaves the
 * Delivery Date filter out so every bucket stays in view; the upcoming list is the list endpoint
 * itself. All three apply the caller's scope on the server — Logistics and QC every order, a sales
 * role its own leads' orders, Accounts the Delivered ones. Every number opens the List narrowed to
 * exactly what it counted (`drillTo`), so the List's total is the number that was clicked.
 *
 * Only the statuses that exist are shown. Out for Delivery, Failed / Not Delivered and Return wait
 * on the client's definitions and are not mapped onto anything.
 */
export function LogisticsDashboard({
  state,
  filters,
  update,
  counts,
  schedule,
  reloadToken,
  toolbarLeft,
  toolbarActions,
  onOpen,
  onReset,
}: {
  state: LogisticsUrlState;
  filters: LogisticsFilters;
  update: (changes: Partial<LogisticsUrlState>) => void;
  counts: Loaded<{ summary: LogisticsSummary | null }>;
  schedule: Loaded<{ schedule: Schedule | null }>;
  reloadToken: number;
  /** The view toggle. */
  toolbarLeft: React.ReactNode;
  /** The screen's search box and Filter control. */
  toolbarActions: React.ReactNode;
  onOpen: (order: LogisticsOrder) => void;
  /** Clears the filters and the search. */
  onReset: () => void;
}) {
  const upcoming = useUpcomingDeliveries(filters, reloadToken);
  const open = (drill: DashboardDrill) => update(drillTo(drill));
  const summary = counts.summary;
  const plan = schedule.schedule;

  const narrowed =
    state.status.length +
      state.delivery.length +
      state.country.length +
      state.city.length +
      state.state.length +
      state.courier.length +
      state.assignedAgent.length >
      0 ||
    state.deliveryOn !== null ||
    state.q !== "";

  const body = (() => {
    if (!summary && !plan && counts.isError && schedule.isError) {
      return (
        <ErrorState
          className="py-16"
          title="Couldn’t load the dashboard"
          description={ordersLoadError(upcoming.error?.status)}
          onRetry={() => {
            counts.retry();
            schedule.retry();
            upcoming.retry();
          }}
        />
      );
    }

    if (summary && plan && isDashboardEmpty(summary.total, plan.buckets)) {
      return (
        <EmptyState
          className="py-16"
          icon={IconTruck}
          title={narrowed ? "No matching orders" : "No orders yet"}
          description={
            narrowed
              ? "No order matches these filters. Clear them to see every order."
              : "An order is created here when a lead is won."
          }
          action={
            narrowed ? (
              <Button variant="secondary" onClick={onReset}>
                Clear filters
              </Button>
            ) : undefined
          }
        />
      );
    }

    return (
      <div className="flex flex-col gap-4">
        {summary && (
          <p className="text-xs text-ink-muted">
            {summary.total.toLocaleString("en-AE")}{" "}
            {summary.total === 1 ? "order" : "orders"} in these filters ·
            Business day {formatDateOnly(summary.businessDay.today)} ·{" "}
            {summary.businessDay.timeZone}
          </p>
        )}

        <DashboardSection title="Delivery dates">
          {/* Choosing a bucket or a day opens the List with that Delivery Date filter. */}
          <LogisticsDeliverySchedule
            choice={{ delivery: state.delivery, deliveryOn: state.deliveryOn }}
            schedule={plan}
            isError={schedule.isError}
            onRetry={schedule.retry}
            onChoose={(choice) => open({ kind: "delivery", choice })}
          />
        </DashboardSection>

        <DashboardSection title="Orders by status">
          <LogisticsSummaryCards
            status={state.status}
            summary={summary}
            isError={counts.isError}
            onRetry={counts.retry}
            onChoose={(status) => open({ kind: "status", status })}
            regions={false}
          />
        </DashboardSection>

        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          <Card className="flex min-w-0 flex-col overflow-hidden p-0">
            <CardTitle
              title="Deliveries by day"
              description="The next two weeks, each day by status. A day opens its orders."
            />
            {plan ? (
              <DaysTable
                days={plan.days}
                day={plan.businessDay}
                onChoose={(date) =>
                  open({
                    kind: "delivery",
                    choice: dayChoice(date, plan.businessDay),
                  })
                }
              />
            ) : (
              <SkeletonRows />
            )}
          </Card>

          <Card className="flex min-w-0 flex-col overflow-hidden p-0">
            <CardTitle
              title="Upcoming deliveries"
              description="Due today or later, soonest first. An order opens its details."
            />
            <UpcomingTable
              upcoming={upcoming}
              onOpen={onOpen}
              onViewAll={() => open({ kind: "upcoming" })}
            />
          </Card>
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 lg:grid-cols-3">
          <RegionCard
            title="By area"
            field="state"
            rows={summary?.states}
            total={summary?.total ?? 0}
            onChoose={(field, value) => open({ kind: "area", field, value })}
          />
          <RegionCard
            title="By city"
            field="city"
            rows={summary?.cities}
            total={summary?.total ?? 0}
            onChoose={(field, value) => open({ kind: "area", field, value })}
          />
          <RegionCard
            title="By country"
            field="country"
            rows={summary?.countries}
            total={summary?.total ?? 0}
            onChoose={(field, value) => open({ kind: "area", field, value })}
          />
        </div>
      </div>
    );
  })();

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col gap-3 px-4 pt-2.5 pb-4 lg:px-6 lg:pb-5">
      <Toolbar left={toolbarLeft} right={toolbarActions} />
      <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">{body}</div>
    </div>
  );
}

function DashboardSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="flex min-w-0 flex-col gap-2">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      {children}
    </section>
  );
}

function CardTitle({
  title,
  description,
}: {
  title: string;
  description: string;
}) {
  return (
    <div className="border-b border-hairline px-4 py-3">
      <h2 className="text-sm font-semibold text-ink">{title}</h2>
      <p className="mt-0.5 text-xs text-ink-muted">{description}</p>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="flex flex-col gap-2 p-4" aria-hidden="true">
      {Array.from({ length: 5 }, (_, index) => (
        <Skeleton key={index} className="h-9 w-full" />
      ))}
    </div>
  );
}

/** The schedule's days as rows: the day's total, then its orders per status. */
function DaysTable({
  days,
  day,
  onChoose,
}: {
  days: readonly DeliveryScheduleDay[];
  day: BusinessDay;
  onChoose: (date: string) => void;
}) {
  const columns: TableColumn<DeliveryScheduleDay>[] = [
    {
      key: "date",
      header: "Day",
      className: "whitespace-nowrap",
      render: (row) => (
        <span className="font-medium text-ink">{dayLabel(row.date, day)}</span>
      ),
    },
    {
      key: "total",
      header: "Total",
      align: "right",
      render: (row) => (
        <span className="font-semibold">{zeroMuted(row.total)}</span>
      ),
    },
    ...LOGISTICS_STATUSES.map((status): TableColumn<DeliveryScheduleDay> => ({
      key: status,
      header: LOGISTICS_STATUS_LABEL[status],
      align: "right",
      render: (row) => zeroMuted(row.counts[status]),
    })),
  ];
  return (
    <ResponsiveTableContainer label="Deliveries by day">
      <Table
        columns={columns}
        rows={days}
        getRowId={(row) => row.date}
        onRowClick={(row) => onChoose(row.date)}
      />
    </ResponsiveTableContainer>
  );
}

function UpcomingTable({
  upcoming,
  onOpen,
  onViewAll,
}: {
  upcoming: ReturnType<typeof useUpcomingDeliveries>;
  onOpen: (order: LogisticsOrder) => void;
  onViewAll: () => void;
}) {
  if (upcoming.error) {
    return (
      <ErrorState
        className="py-10"
        title="Couldn’t load the upcoming deliveries"
        description={ordersLoadError(upcoming.error.status)}
        onRetry={upcoming.retry}
      />
    );
  }
  if (!upcoming.loaded) return <SkeletonRows />;
  if (upcoming.loaded.rows.length === 0) {
    return (
      <p className="px-4 py-10 text-center text-sm text-ink-muted">
        No order in these filters is due today or later.
      </p>
    );
  }

  const columns: TableColumn<LogisticsOrder>[] = [
    {
      key: "deliveryDate",
      header: "Delivery",
      className: "whitespace-nowrap",
      render: (order) => (
        <LogisticsDeliveryDate
          date={order.deliveryDate}
          bucket={order.deliveryBucket}
        />
      ),
    },
    {
      key: "orderNumber",
      header: "Order #",
      render: (order) => (
        <span className="font-medium text-ink">
          {orderNumberLabel(order.orderNumber)}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      render: (order) => order.customerName,
    },
    {
      key: "area",
      header: "Area",
      render: (order) =>
        order.state ?? order.city ?? <span className="text-ink-subtle">—</span>,
    },
    {
      key: "status",
      header: "Status",
      render: (order) => <LogisticsStatusBadge status={order.status} />,
    },
    {
      key: "courier",
      header: "Delivery Partner",
      render: (order) =>
        order.courier ?? <span className="text-ink-subtle">—</span>,
    },
  ];
  const { rows, total } = upcoming.loaded;
  return (
    <>
      <ResponsiveTableContainer label="Upcoming deliveries">
        <Table
          columns={columns}
          rows={rows}
          getRowId={(order) => order.id}
          onRowClick={onOpen}
        />
      </ResponsiveTableContainer>
      <div className="flex items-center justify-between gap-3 border-t border-hairline px-4 py-2.5">
        <span className="text-xs text-ink-muted">
          {rows.length} of {total.toLocaleString("en-AE")}
        </span>
        <Button variant="secondary" onClick={onViewAll}>
          View all {total.toLocaleString("en-AE")}
        </Button>
      </div>
    </>
  );
}

/**
 * One region breakdown: a row per value, most orders first, with its share of the total; a row
 * opens the List of that value. Orders with none recorded come last and open nothing — the API has
 * no filter for "not recorded", and a link that showed something else would mislead.
 */
function RegionCard({
  title,
  field,
  rows,
  total,
  onChoose,
}: {
  title: string;
  field: AreaField;
  rows: readonly RegionCount[] | undefined;
  total: number;
  onChoose: (field: AreaField, value: string) => void;
}) {
  return (
    <Card className="flex min-w-0 flex-col overflow-hidden p-0">
      <div className="border-b border-hairline px-4 py-3">
        <h2 className="text-sm font-semibold text-ink">{title}</h2>
      </div>
      {!rows ? (
        <SkeletonRows />
      ) : rows.length === 0 ? (
        <p className="px-4 py-8 text-center text-sm text-ink-muted">
          No orders in these filters.
        </p>
      ) : (
        <ul
          aria-label={`Orders ${title.toLowerCase()}`}
          className="scrollbar-slim flex max-h-80 flex-col overflow-y-auto py-1"
        >
          {rows.map(({ value, count }) => {
            const line = (
              <>
                <span className="flex min-w-0 items-center justify-between gap-3">
                  <span
                    className={
                      value === null
                        ? "truncate text-ink-muted"
                        : "truncate text-ink"
                    }
                  >
                    {value ?? "Not recorded"}
                  </span>
                  <span className="shrink-0 tabular-nums">
                    <span className="font-semibold text-ink">
                      {count.toLocaleString("en-AE")}
                    </span>{" "}
                    <span className="text-xs text-ink-muted">
                      {shareOf(count, total)}
                    </span>
                  </span>
                </span>
                <span
                  aria-hidden="true"
                  className="block h-1.5 overflow-hidden rounded-full bg-canvas"
                >
                  <span
                    className="block h-full rounded-full bg-brand"
                    style={{ width: `${barWidth(count, rows)}%` }}
                  />
                </span>
              </>
            );
            return (
              <li key={value ?? ""}>
                {value === null ? (
                  <div className="flex flex-col gap-1 px-4 py-2 text-sm">
                    {line}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => onChoose(field, value)}
                    aria-label={`${value}: ${count} ${count === 1 ? "order" : "orders"} — open the list`}
                    className="focus-ring flex w-full flex-col gap-1 px-4 py-2 text-left text-sm transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
                  >
                    {line}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
