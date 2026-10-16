"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconTruck } from "@tabler/icons-react";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Skeleton } from "@/components/ui/Skeleton";
import { LogisticsDeliveryDate } from "@/components/logistics/logistics-delivery-date";
import { LOGISTICS_STATUS_TONE } from "@/components/logistics/logistics-status-badge";
import { ApiError, isAbortError } from "@/lib/api-client";
import { cn } from "@/lib/cn";
import { formatDate } from "@/lib/format";
import {
  BOARD_PAGE_SIZE,
  LOGISTICS_STATUS_LABEL,
  logisticsFilterParams,
  orderNumberLabel,
  ordersLoadError,
  shownStatuses,
  type LogisticsFilters,
  type LogisticsSortDirection,
  type LogisticsSortKey,
  type LogisticsStatus,
} from "@/lib/logistics-orders";
import {
  fetchLogisticsOrders,
  type LogisticsOrder,
} from "@/services/logistics-service";
import type { Tone } from "@/types";

/** Column header fill and border, by the status's tone — the StatCard surfaces. */
const HEADER_TINT: Record<Tone, string> = {
  brand: "border-brand/40 bg-brand/10",
  neutral: "border-hairline bg-canvas",
  success: "border-success/40 bg-success/10",
  warning: "border-warning/40 bg-warning/10",
  danger: "border-danger/40 bg-danger/10",
  info: "border-info/40 bg-info/10",
};

const HEADER_DOT: Record<Tone, string> = {
  brand: "bg-brand",
  neutral: "bg-ink-muted",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-danger",
  info: "bg-info",
};

type BoardFilters = LogisticsFilters & {
  sort: LogisticsSortKey;
  direction: LogisticsSortDirection;
};

/**
 * One column as last read. `key` names the filters (and reload) it answers, so a column read
 * under older filters shows as loading rather than as stale orders. `failed` is the HTTP status
 * of a failed first page (0 when no response came back).
 */
type Column = {
  key: string;
  rows: readonly LogisticsOrder[];
  total: number;
  page: number;
  failed?: number;
  loadingMore?: boolean;
  moreFailed?: boolean;
};

/**
 * The columns' orders: each shown status's first page from `GET /logistics/orders?status=…` —
 * the list's own endpoint, scope and filters, with the column's status in place of the Status
 * filter, so the board holds the same records the List does — and further pages on demand.
 * Nothing is set synchronously inside the effect: results land in `.then`, keyed by the filters
 * they answer.
 */
function useBoardColumns(filters: BoardFilters, reloadToken: number) {
  const key = `${reloadToken}:${logisticsFilterParams(filters)}:${filters.sort}:${filters.direction}`;
  const statuses = shownStatuses(filters.status ?? []);
  const [columns, setColumns] = useState<
    Partial<Record<LogisticsStatus, Column>>
  >({});
  // The filters now in force. A retry is not aborted when they change, so its late answer is
  // dropped here rather than written over a column the newer filters already filled.
  const latestKey = useRef(key);
  useEffect(() => {
    latestKey.current = key;
  }, [key]);

  const loadFirst = useCallback(
    (status: LogisticsStatus, signal?: AbortSignal) => {
      const write = (column: Column) =>
        setColumns((prev) =>
          latestKey.current === key ? { ...prev, [status]: column } : prev,
        );
      fetchLogisticsOrders(
        { ...filters, page: 1, size: BOARD_PAGE_SIZE, status: [status] },
        signal,
      )
        .then((result) =>
          write({ key, rows: result.rows, total: result.total, page: 1 }),
        )
        .catch((error: unknown) => {
          if (isAbortError(error)) return;
          write({
            key,
            rows: [],
            total: 0,
            page: 0,
            failed: error instanceof ApiError ? error.status : 0,
          });
        });
    },
    [filters, key],
  );

  useEffect(() => {
    const controller = new AbortController();
    for (const status of statuses) {
      loadFirst(status, controller.signal);
    }
    return () => controller.abort();
  }, [loadFirst, statuses]);

  const retry = (status: LogisticsStatus) => {
    setColumns((prev) => ({ ...prev, [status]: undefined }));
    loadFirst(status);
  };

  const loadMore = (status: LogisticsStatus) => {
    const column = columns[status];
    if (!column || column.key !== key || column.loadingMore) return;
    const page = column.page + 1;
    const settle = (next: (current: Column) => Column) =>
      setColumns((prev) => {
        const current = prev[status];
        return current && current.key === key
          ? { ...prev, [status]: next(current) }
          : prev;
      });
    settle((current) => ({ ...current, loadingMore: true, moreFailed: false }));
    fetchLogisticsOrders({
      ...filters,
      page,
      size: BOARD_PAGE_SIZE,
      status: [status],
    })
      .then((result) =>
        settle((current) => {
          // An order can move between two page reads; it is shown once.
          const seen = new Set(current.rows.map((order) => order.id));
          return {
            key,
            rows: [
              ...current.rows,
              ...result.rows.filter((order) => !seen.has(order.id)),
            ],
            total: result.total,
            page,
          };
        }),
      )
      .catch(() =>
        settle((current) => ({
          ...current,
          loadingMore: false,
          moreFailed: true,
        })),
      );
  };

  return { key, statuses, columns, retry, loadMore };
}

/**
 * The Pipeline view of the Logistics screen: one column per order status, in the order an order
 * moves through them, holding the same orders the List shows under the same filters, search and
 * sort. With statuses chosen in the Status filter only their columns show. A card opens the
 * order's panel, which carries every action the backend allows; a status is never changed by
 * dragging here.
 */
export function LogisticsBoard({
  filters,
  sort,
  direction,
  toolbarLeft,
  toolbarActions,
  summary,
  reloadToken,
  onOpen,
}: {
  /** The screen's filters and search, as every view and the counts send them. */
  filters: LogisticsFilters;
  sort: LogisticsSortKey;
  direction: LogisticsSortDirection;
  /** The view toggle. */
  toolbarLeft: React.ReactNode;
  /** The screen's search box and Filter control. */
  toolbarActions: React.ReactNode;
  /** The counts. */
  summary: React.ReactNode;
  /** Moves after an order action, so every column is read again. */
  reloadToken: number;
  onOpen: (order: LogisticsOrder) => void;
}) {
  const boardFilters = useMemo<BoardFilters>(
    () => ({ ...filters, sort, direction }),
    [filters, sort, direction],
  );
  const { key, statuses, columns, retry, loadMore } = useBoardColumns(
    boardFilters,
    reloadToken,
  );

  const current = statuses.map((status) => {
    const column = columns[status];
    return column?.key === key ? column : undefined;
  });
  const settled = current.every((column) => column !== undefined);
  const failures = current.filter((column) => column?.failed !== undefined);
  const narrowed = logisticsFilterParams(filters).toString() !== "";

  let body: React.ReactNode;
  if (failures.length === statuses.length) {
    body = (
      <ErrorState
        title="Couldn’t load orders"
        description={ordersLoadError(failures[0]?.failed)}
        onRetry={() => statuses.forEach(retry)}
      />
    );
  } else if (
    settled &&
    failures.length === 0 &&
    current.every((column) => column?.total === 0)
  ) {
    body = (
      <EmptyState
        icon={IconTruck}
        title={narrowed ? "No matching orders" : "No orders yet"}
        description={
          narrowed
            ? "Try other filters or another search."
            : "An order is created here when a lead is won."
        }
      />
    );
  } else {
    body = (
      <div className="flex h-full w-max gap-[13px] p-3">
        {statuses.map((status, index) => (
          <BoardColumn
            key={status}
            status={status}
            column={current[index]}
            onOpen={onOpen}
            onRetry={() => retry(status)}
            onLoadMore={() => loadMore(status)}
          />
        ))}
      </div>
    );
  }

  return (
    <TablePageLayout
      title="Logistics"
      tableLabel="Logistics pipeline board"
      toolbarLeft={toolbarLeft}
      toolbarActions={toolbarActions}
      summary={summary}
    >
      {body}
    </TablePageLayout>
  );
}

/** One status: its header with the count, then its cards, read a page at a time. */
function BoardColumn({
  status,
  column,
  onOpen,
  onRetry,
  onLoadMore,
}: {
  status: LogisticsStatus;
  /** Undefined while the column's first page is loading. */
  column: Column | undefined;
  onOpen: (order: LogisticsOrder) => void;
  onRetry: () => void;
  onLoadMore: () => void;
}) {
  const tone = LOGISTICS_STATUS_TONE[status];
  const label = LOGISTICS_STATUS_LABEL[status];

  return (
    // 240px wide, 13px apart, cards 14px apart: the Leads Kanban's measured column (ADR-0076).
    <section
      aria-label={label}
      className="flex h-full w-[240px] shrink-0 flex-col"
    >
      <header
        className={cn(
          "flex items-center gap-2 rounded-control border px-2.5 py-1.5",
          HEADER_TINT[tone],
        )}
      >
        <span
          className={cn("size-2.5 shrink-0 rounded-full", HEADER_DOT[tone])}
          aria-hidden="true"
        />
        <h3 className="truncate text-[13px] font-semibold text-ink">{label}</h3>
        {column && column.failed === undefined && (
          <span className="ml-auto shrink-0 rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-ink-muted">
            {column.total.toLocaleString("en-AE")}
          </span>
        )}
      </header>

      <div className="scrollbar-none mt-2 min-h-0 flex-1 space-y-3.5 overflow-y-auto">
        {!column ? (
          Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-24 w-full rounded-surface" />
          ))
        ) : column.failed !== undefined ? (
          <div className="px-2 py-8 text-center text-sm">
            <p className="text-ink-muted">Couldn’t load orders.</p>
            <button
              type="button"
              onClick={onRetry}
              className="focus-ring mt-1 rounded-control text-brand-strong underline"
            >
              Try again
            </button>
          </div>
        ) : column.rows.length === 0 ? (
          <p className="px-2 py-8 text-center text-sm text-ink-muted">
            No orders in this status.
          </p>
        ) : (
          <>
            {column.rows.map((order) => (
              <BoardCard key={order.id} order={order} onOpen={onOpen} />
            ))}
            {column.loadingMore && (
              <Skeleton className="h-24 w-full rounded-surface" />
            )}
            {column.rows.length < column.total && !column.loadingMore && (
              <button
                type="button"
                onClick={onLoadMore}
                className="focus-ring flex h-[27px] w-full shrink-0 items-center justify-center rounded-control border border-dashed border-hairline text-xs text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:border-ink-subtle hover:text-ink"
              >
                {column.moreFailed
                  ? "Couldn’t load more — try again"
                  : `Load more (${column.total - column.rows.length})`}
              </button>
            )}
          </>
        )}
      </div>
    </section>
  );
}

/** One order: its number, customer and shipment at a glance. Opens the order panel. */
function BoardCard({
  order,
  onOpen,
}: {
  order: LogisticsOrder;
  onOpen: (order: LogisticsOrder) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(order)}
      className="focus-ring block w-full rounded-surface border border-hairline bg-surface p-2.5 text-left shadow-sm transition-colors duration-(--duration-shell) ease-shell hover:border-ink-subtle"
    >
      <span className="flex items-center justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink">
          {orderNumberLabel(order.orderNumber)}
        </span>
        <span className="text-xs text-ink-muted">
          {formatDate(order.convertedAt)}
        </span>
      </span>
      <span className="mt-1 block truncate text-sm text-ink">
        {order.customerName}
      </span>
      <span className="block truncate text-xs text-ink-muted">
        {order.primaryPhone}
      </span>
      <span className="mt-1 block text-xs">
        <LogisticsDeliveryDate
          date={order.deliveryDate}
          bucket={order.deliveryBucket}
        />
      </span>
      {order.awbNumber && (
        <span className="mt-1 block truncate text-xs text-ink-muted">
          AWB {order.awbNumber}
          {order.courier ? ` · ${order.courier}` : ""}
        </span>
      )}
    </button>
  );
}
