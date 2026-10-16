"use client";

import { useEffect, useMemo, useState } from "react";
import { IconEye, IconTruck } from "@tabler/icons-react";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Table } from "@/components/ui/Table";
import { TabStrip } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAuth } from "@/components/auth/auth-context";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LogisticsDeliveryDate } from "@/components/logistics/logistics-delivery-date";
import { LogisticsStatusBadge } from "@/components/logistics/logistics-status-badge";
import { can } from "@/constants/permissions";
import { ApiError, isAbortError } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import {
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  isLogisticsSortKey,
  orderNumberLabel,
  ordersLoadError,
  type LogisticsFilters,
  type LogisticsOrdersQuery,
  type LogisticsStatus,
  type LogisticsUrlState,
} from "@/lib/logistics-orders";
import {
  fetchLogisticsOrders,
  type LogisticsOrder,
} from "@/services/logistics-service";
import type { TableColumn } from "@/types";

const ALL = "ALL";

const TABS = [
  { id: ALL, label: "All" },
  ...LOGISTICS_STATUSES.map((status) => ({
    id: status,
    label: LOGISTICS_STATUS_LABEL[status],
  })),
];

const dash = <span className="text-ink-subtle">—</span>;

type Loaded = {
  query: LogisticsOrdersQuery;
  rows: readonly LogisticsOrder[];
  total: number;
};

type Failed = { query: LogisticsOrdersQuery; status?: number };

/**
 * One page of orders and its lifecycle, by the `useActivitiesList` rules: a result counts only
 * while it answers the query in hand (a slow earlier page cannot repaint a newer one), and no
 * state is set synchronously inside the effect. A `reloadToken` change re-reads the same page
 * in the background, keeping its rows on screen until the new ones arrive.
 */
function useLogisticsOrders(query: LogisticsOrdersQuery, reloadToken: number) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<Failed | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLogisticsOrders(query, controller.signal)
      .then((result) => {
        if (!active) return;
        setLoaded({ query, rows: result.rows, total: result.total });
        setFailed(null);
      })
      .catch((error: unknown) => {
        if (!active || isAbortError(error)) return;
        setFailed({
          query,
          status: error instanceof ApiError ? error.status : undefined,
        });
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, reloadToken, retryToken]);

  const isCurrent = loaded?.query === query;
  const isError = failed?.query === query;
  return {
    rows: isCurrent ? loaded.rows : [],
    total: isCurrent ? loaded.total : 0,
    isLoading: !isCurrent && !isError,
    error: isError ? { status: failed.status } : null,
    retry: () => setRetryToken((token) => token + 1),
  };
}

/**
 * The List view of the Logistics screen (ADR-0085): the caller's orders a page at a time,
 * narrowed by the screen's filters and search, ordered by any sortable column. Its filters,
 * page, size and sort live in the address (`LogisticsView`), so a reload or a shared link opens
 * the same page. The scope is the API's — the Logistics roles see every order, a sales role its
 * own converted leads' — and this view shows exactly what comes back.
 *
 * The status tabs are one-click forms of the Status filter: "All" clears it, a status tab
 * chooses that status alone, and with several statuses chosen in the Filter panel no tab is
 * selected.
 *
 * No Workpex screen exists for Logistics, so it is built from the Emarath frame the other lists
 * use (CLAUDE.md §1A): `TablePageLayout`, the shared `Table`, `TabStrip` and `ToolbarSearch`.
 */
export function LogisticsListView({
  state,
  filters,
  update,
  toolbarLeft,
  toolbarActions,
  summary,
  reloadToken,
  onOpen,
  onReset,
}: {
  state: LogisticsUrlState;
  /** The screen's filters and search, as every view and the counts send them. */
  filters: LogisticsFilters;
  update: (changes: Partial<LogisticsUrlState>) => void;
  /** The view toggle, ahead of the status tabs. */
  toolbarLeft: React.ReactNode;
  /** The screen's search box and Filter control. */
  toolbarActions: React.ReactNode;
  /** The counts. */
  summary: React.ReactNode;
  /** Moves after an order action, so the page is read again. */
  reloadToken: number;
  onOpen: (order: LogisticsOrder) => void;
  /** Clears the filters — the way out of an address the API refused. */
  onReset: () => void;
}) {
  const query = useMemo<LogisticsOrdersQuery>(
    () => ({
      ...filters,
      page: state.page,
      size: state.size,
      sort: state.sort,
      direction: state.direction,
    }),
    [filters, state.page, state.size, state.sort, state.direction],
  );
  const { rows, total, isLoading, error, retry } = useLogisticsOrders(
    query,
    reloadToken,
  );
  const pageCount = Math.max(1, Math.ceil(total / state.size));

  // An action that moves an order out of the filters, or a link to a page past the end, can
  // leave the page empty while orders remain: step back to the last page that has rows.
  useEffect(() => {
    if (!isLoading && !error && rows.length === 0 && state.page > pageCount) {
      update({ page: pageCount });
    }
  }, [isLoading, error, rows.length, state.page, pageCount, update]);

  const { user } = useAuth();
  // The lead is sales data the Logistics roles cannot open (ADR-0084): for them the name is
  // plain text, not a link to a page that would refuse them.
  const canOpenLead = can(user?.role, "useSalesModules");

  const columns: TableColumn<LogisticsOrder>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      sortable: true,
      render: (order) => (
        <span className="font-medium text-ink">
          {orderNumberLabel(order.orderNumber)}
        </span>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (order) => (
        <div className="flex flex-col">
          {canOpenLead ? (
            <CustomerNameLink leadId={order.leadId} name={order.customerName} />
          ) : (
            <span className="text-ink">{order.customerName}</span>
          )}
          <span className="text-xs text-ink-muted">{order.primaryPhone}</span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Status",
      sortable: true,
      render: (order) => <LogisticsStatusBadge status={order.status} />,
    },
    {
      key: "deliveryDate",
      header: "Delivery Date",
      sortable: true,
      render: (order) => (
        <LogisticsDeliveryDate
          date={order.deliveryDate}
          bucket={order.deliveryBucket}
        />
      ),
    },
    {
      key: "awbNumber",
      header: "AWB",
      render: (order) => order.awbNumber ?? dash,
    },
    {
      key: "courier",
      header: "Courier",
      render: (order) => order.courier ?? dash,
    },
    {
      key: "convertedAt",
      header: "Created",
      sortable: true,
      render: (order) => formatDateTime(order.convertedAt),
    },
    {
      key: "statusChangedAt",
      header: "Updated",
      sortable: true,
      render: (order) => formatDateTime(order.statusChangedAt),
    },
    {
      key: "actions",
      header: "Actions",
      render: (order) => (
        <Tooltip content="View Details">
          <IconButton aria-label="View Details" onClick={() => onOpen(order)}>
            <IconEye size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const narrowed =
    state.status.length +
      state.delivery.length +
      state.country.length +
      state.city.length >
      0 ||
    state.deliveryOn !== null ||
    state.q !== "";

  return (
    <TablePageLayout
      title="Logistics"
      tableLabel="Logistics orders table"
      toolbarLeft={
        <>
          {toolbarLeft}
          <TabStrip
            tabs={TABS}
            value={
              state.status.length === 0
                ? ALL
                : state.status.length === 1
                  ? state.status[0]
                  : ""
            }
            onValueChange={(next) =>
              update({
                status: next === ALL ? [] : [next as LogisticsStatus],
                page: 1,
              })
            }
          />
        </>
      }
      toolbarActions={toolbarActions}
      summary={summary}
      pagination={{
        page: state.page,
        pageCount,
        total,
        onPageChange: (page) => update({ page }),
        pageSize: state.size,
        onPageSizeChange: (size) => update({ size, page: 1 }),
      }}
    >
      <Table
        columns={columns}
        rows={rows}
        getRowId={(order) => order.id}
        sort={{ key: state.sort, direction: state.direction }}
        onSortChange={(sort) => {
          if (isLogisticsSortKey(sort.key)) {
            update({ sort: sort.key, direction: sort.direction, page: 1 });
          }
        }}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={IconTruck}
            title={narrowed ? "No matching orders" : "No orders yet"}
            description={
              narrowed
                ? "Try other filters or another search."
                : "An order is created here when a lead is won."
            }
          />
        }
        errorState={
          error ? (
            <ErrorState
              title="Couldn’t load orders"
              description={ordersLoadError(error.status)}
              onRetry={error.status === 400 ? onReset : retry}
            />
          ) : undefined
        }
      />
    </TablePageLayout>
  );
}
