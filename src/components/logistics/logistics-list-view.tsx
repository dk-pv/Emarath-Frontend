"use client";

import { useEffect, useMemo, useState } from "react";
import { IconEye, IconTruck } from "@tabler/icons-react";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Table } from "@/components/ui/Table";
import { TabStrip } from "@/components/ui/Tabs";
import { Tooltip } from "@/components/ui/Tooltip";
import { useAuth } from "@/components/auth/auth-context";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { LogisticsOrderDrawer } from "@/components/logistics/logistics-order-drawer";
import { LogisticsStatusBadge } from "@/components/logistics/logistics-status-badge";
import { can } from "@/constants/permissions";
import { DEFAULT_PAGE_SIZE, SEARCH_DEBOUNCE_MS } from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { formatDateTime } from "@/lib/format";
import {
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  orderNumberLabel,
  type LogisticsOrdersQuery,
  type LogisticsStatus,
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

/**
 * One page of orders and its lifecycle, by the `useActivitiesList` rules: a result counts only
 * while it answers the query in hand (a slow earlier page cannot repaint a newer one), and no
 * state is set synchronously inside the effect.
 */
function useLogisticsOrders(query: LogisticsOrdersQuery) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failedQuery, setFailedQuery] = useState<LogisticsOrdersQuery | null>(
    null,
  );
  const [reloadToken, setReloadToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchLogisticsOrders(query, controller.signal)
      .then((result) => {
        if (active) {
          setLoaded({ query, rows: result.rows, total: result.total });
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        if (error instanceof DOMException && error.name === "AbortError")
          return;
        setFailedQuery(query);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [query, reloadToken]);

  const isCurrent = loaded?.query === query;
  const isError = failedQuery === query;
  return {
    rows: isCurrent ? loaded.rows : [],
    total: isCurrent ? loaded.total : 0,
    isLoading: !isCurrent && !isError,
    isError,
    refetch: () => {
      setFailedQuery(null);
      setReloadToken((token) => token + 1);
    },
  };
}

/**
 * The Logistics order queue (Phase 4 foundation, ADR-0085): every order the caller may read,
 * newest first, narrowed by status and a server-side search. The scope is the API's — the
 * Logistics roles see every order, a sales role its own converted leads' — and this page shows
 * exactly what comes back. Actions live in the order panel and are only ever the backend's
 * `allowedActions` (see `LogisticsOrderDrawer`); after one, the list is read again.
 *
 * No Workpex screen exists for Logistics, so it is built from the Emarath frame the other lists
 * use (CLAUDE.md §1A): `TablePageLayout`, the shared `Table`, `TabStrip` and `ToolbarSearch`.
 */
export function LogisticsListView() {
  const [status, setStatus] = useState<string>(ALL);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [size, setSize] = useState(DEFAULT_PAGE_SIZE);
  const [selected, setSelected] = useState<LogisticsOrder | null>(null);

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);

  const query = useMemo<LogisticsOrdersQuery>(
    () => ({
      page,
      size,
      status: status === ALL ? undefined : (status as LogisticsStatus),
      search: debouncedSearch.trim() || undefined,
    }),
    [page, size, status, debouncedSearch],
  );
  const { rows, total, isLoading, isError, refetch } =
    useLogisticsOrders(query);
  const pageCount = Math.max(1, Math.ceil(total / size));

  const { user } = useAuth();
  // The lead is sales data the Logistics roles cannot open (ADR-0084): for them the name is
  // plain text, not a link to a page that would refuse them.
  const canOpenLead = can(user?.role, "useSalesModules");

  const columns: TableColumn<LogisticsOrder>[] = [
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
      key: "customer",
      header: "Customer",
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
      render: (order) => <LogisticsStatusBadge status={order.status} />,
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
      key: "created",
      header: "Created",
      render: (order) => formatDateTime(order.convertedAt),
    },
    {
      key: "updated",
      header: "Updated",
      render: (order) => formatDateTime(order.statusChangedAt),
    },
    {
      key: "actions",
      header: "Actions",
      render: (order) => (
        <Tooltip content="View Details">
          <IconButton
            aria-label="View Details"
            onClick={() => setSelected(order)}
          >
            <IconEye size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const narrowed = status !== ALL || debouncedSearch.trim() !== "";

  return (
    <TablePageLayout
      title="Logistics"
      tableLabel="Logistics orders table"
      toolbarLeft={
        <TabStrip
          tabs={TABS}
          value={status}
          onValueChange={(next) => {
            setStatus(next);
            setPage(1);
          }}
        />
      }
      toolbarActions={
        <ToolbarSearch
          value={search}
          onChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          placeholder="Search order #, customer, phone or AWB"
        />
      }
      pagination={{
        page,
        pageCount,
        total,
        onPageChange: setPage,
        pageSize: size,
        onPageSizeChange: (next) => {
          setSize(next);
          setPage(1);
        },
      }}
    >
      <Table
        columns={columns}
        rows={rows}
        getRowId={(order) => order.id}
        isLoading={isLoading}
        emptyState={
          <EmptyState
            icon={IconTruck}
            title={narrowed ? "No matching orders" : "No orders yet"}
            description={
              narrowed
                ? "Try another status or search."
                : "An order is created here when a lead is won."
            }
          />
        }
        errorState={
          isError ? (
            <ErrorState
              title="Couldn’t load orders"
              description="Something went wrong while loading orders. Check your connection and try again."
              onRetry={refetch}
            />
          ) : undefined
        }
      />

      {selected && (
        <LogisticsOrderDrawer
          order={selected}
          onClose={() => setSelected(null)}
          onOrderChange={(next) => {
            setSelected(next);
            refetch();
          }}
        />
      )}
    </TablePageLayout>
  );
}
