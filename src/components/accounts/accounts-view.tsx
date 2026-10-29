"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { IconEye, IconReceipt } from "@tabler/icons-react";
import { FilterPanel } from "@/components/filters/filter-panel";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { IconButton } from "@/components/ui/IconButton";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatStrip } from "@/components/ui/StatStrip";
import { Table } from "@/components/ui/Table";
import { Tooltip } from "@/components/ui/Tooltip";
import { useToast } from "@/components/ui/Toast";
import { AccountsRecordDrawer } from "@/components/accounts/accounts-record-drawer";
import {
  PAYMENT_STATUS_TONE,
  PaymentStatusBadge,
} from "@/components/accounts/payment-status-badge";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
} from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { ApiError, isAbortError } from "@/lib/api-client";
import {
  DEFAULT_ACCOUNTS_SORT,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  accountsFilterParams,
  accountsUrlParams,
  isAccountsSortKey,
  parseAccountsUrl,
  recordsLoadError,
  type AccountsFilterOptions,
  type AccountsFilters,
  type AccountsRecordsQuery,
  type AccountsSummary,
  type AccountsUrlState,
  type PaymentStatus,
} from "@/lib/accounts-records";
import { formatAED, formatDate, formatTime } from "@/lib/format";
import { orderNumberLabel } from "@/lib/logistics-orders";
import {
  fetchAccountsFilterOptions,
  fetchAccountsRecord,
  fetchAccountsRecords,
  fetchAccountsSummary,
  type AccountsRecord,
} from "@/services/accounts-service";
import type { FilterField, TableColumn } from "@/types";

const LIMITS = {
  pageSizes: PAGE_SIZE_OPTIONS,
  defaultSize: DEFAULT_PAGE_SIZE,
  searchMax: SEARCH_MAX_LENGTH,
};

const STATUS_OPTIONS = PAYMENT_STATUSES.map((status) => ({
  value: status,
  label: PAYMENT_STATUS_LABEL[status],
}));

const dash = <span className="text-ink-subtle">—</span>;

/** The date over its time, as the Logistics list shows them. */
const stamp = (iso: string) => (
  <span className="flex flex-col">
    {formatDate(iso)}
    <span className="text-xs text-ink-muted">{formatTime(iso)}</span>
  </span>
);

/** The screen's state, read from the address and written back to it, as the Logistics screen. */
function useAccountsUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  const state = useMemo(() => parseAccountsUrl(params, LIMITS), [params]);
  const update = useCallback(
    (changes: Partial<AccountsUrlState>) => {
      // From the address as it is now, so two updates in one event both land.
      const current = parseAccountsUrl(
        new URLSearchParams(window.location.search),
        LIMITS,
      );
      const query = accountsUrlParams(
        { ...current, ...changes },
        LIMITS.defaultSize,
      ).toString();
      window.history.replaceState(
        null,
        "",
        query ? `${pathname}?${query}` : pathname,
      );
    },
    [pathname],
  );
  return [state, update] as const;
}

type Loaded = {
  query: AccountsRecordsQuery;
  rows: readonly AccountsRecord[];
  total: number;
};

/**
 * One page of records, by the Logistics list's rules: a result counts only while it answers the
 * query in hand, and a `reloadToken` change re-reads the same page keeping its rows on screen.
 */
function useAccountsRecords(query: AccountsRecordsQuery, reloadToken: number) {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [failed, setFailed] = useState<{
    query: AccountsRecordsQuery;
    status?: number;
  } | null>(null);
  const [retryToken, setRetryToken] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    let active = true;
    fetchAccountsRecords(query, controller.signal)
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
 * The counts for `filters`, re-read when `reloadToken` moves. The last counts stay on screen while
 * a newer read is in flight; a failure only shows when there is nothing to show instead.
 */
function useAccountsSummary(filters: AccountsFilters, reloadToken: number) {
  const [retryToken, setRetryToken] = useState(0);
  const key = `${reloadToken}:${retryToken}:${accountsFilterParams({ ...filters, status: [] })}`;
  const [loaded, setLoaded] = useState<AccountsSummary | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    fetchAccountsSummary(filters, controller.signal)
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

/** The values offered, then any chosen value no longer offered — so it shows and can be removed. */
function choices(offered: readonly string[], chosen: readonly string[]) {
  return [
    ...offered,
    ...chosen.filter((value) => !offered.includes(value)),
  ].map((value) => ({ value, label: value }));
}

/**
 * The Accounts screen (ADR-0096; client specification §4 steps 11-12, §6, §10): every delivered
 * order's payment record, a page at a time, with the count per payment status above it. Delivering
 * an order is what puts it here, at Initial; Accounts moves it as payment comes in, and the open
 * record's panel shows the order, its Journey and the moves the backend offers this caller.
 *
 * Its status filter, filters, search, page, sort and open record live in the address, as on the
 * Logistics screen. No Workpex screen exists for Accounts, so it is built from the Emarath frame
 * the other lists use (CLAUDE.md §1A): `TablePageLayout`, the shared `Table`, the filter popover
 * and the `StatStrip` the Logistics counts use.
 */
export function AccountsView() {
  const [state, update] = useAccountsUrl();
  const { toast } = useToast();

  const [search, setSearch] = useState(state.q);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const lastSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch === lastSearch.current) return;
    lastSearch.current = debouncedSearch;
    update({ q: debouncedSearch.trim(), page: 1 });
  }, [debouncedSearch, update]);

  // Keyed by the request they make, so the list and the counts read again only when a filter's
  // values change — not when the page, the sort or the open record does.
  const filterKey = accountsFilterParams({
    status: state.status,
    paymentMethod: state.paymentMethod,
    courier: state.courier,
    search: state.q,
  }).toString();
  const filters = useMemo<AccountsFilters>(() => {
    const params = new URLSearchParams(filterKey);
    return {
      status: params.getAll("status") as PaymentStatus[],
      paymentMethod: params.getAll("paymentMethod"),
      courier: params.getAll("courier"),
      search: params.get("search") ?? undefined,
    };
  }, [filterKey]);

  const [reloadToken, setReloadToken] = useState(0);
  const query = useMemo<AccountsRecordsQuery>(
    () => ({
      ...filters,
      page: state.page,
      size: state.size,
      sort: state.sort,
      direction: state.direction,
    }),
    [filters, state.page, state.size, state.sort, state.direction],
  );
  const { rows, total, isLoading, error, retry } = useAccountsRecords(
    query,
    reloadToken,
  );
  const counts = useAccountsSummary(filters, reloadToken);
  const pageCount = Math.max(1, Math.ceil(total / state.size));

  // A move that takes a record out of the filters can leave the page empty while records remain.
  useEffect(() => {
    if (!isLoading && !error && rows.length === 0 && state.page > pageCount) {
      update({ page: pageCount });
    }
  }, [isLoading, error, rows.length, state.page, pageCount, update]);

  const [options, setOptions] = useState<AccountsFilterOptions | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetchAccountsFilterOptions(controller.signal)
      .then(setOptions)
      .catch(() => {});
    return () => controller.abort();
  }, [reloadToken]);

  // The open record: the row that was clicked, or — on arrival by link — read from the API.
  const [selected, setSelected] = useState<AccountsRecord | null>(null);
  useEffect(() => {
    if (!state.record || selected?.id === state.record) return;
    const controller = new AbortController();
    fetchAccountsRecord(state.record, controller.signal)
      .then(setSelected)
      .catch((reason: unknown) => {
        if (isAbortError(reason)) return;
        toast({
          title: "Couldn’t open that record",
          description: "It doesn’t exist, or it isn’t one you can see.",
          tone: "danger",
        });
        update({ record: null });
      });
    return () => controller.abort();
  }, [state.record, selected?.id, toast, update]);
  const open = selected && selected.id === state.record ? selected : null;
  const openRecord = (record: AccountsRecord) => {
    setSelected(record);
    update({ record: record.id });
  };

  const fields = useMemo<FilterField[]>(
    () => [
      {
        key: "status",
        label: "Payment Status",
        type: "multi",
        options: STATUS_OPTIONS,
      },
      {
        key: "paymentMethod",
        label: "Payment Method",
        type: "multi",
        searchable: true,
        options: choices(options?.paymentMethods ?? [], state.paymentMethod),
      },
      {
        key: "courier",
        label: "Delivery Partner",
        type: "multi",
        searchable: true,
        options: choices(options?.couriers ?? [], state.courier),
      },
    ],
    [options, state.paymentMethod, state.courier],
  );

  const columns: TableColumn<AccountsRecord>[] = [
    {
      key: "orderNumber",
      header: "Order #",
      sortable: true,
      // Opens the record's panel, as the row's View Details does.
      render: (record) => (
        <button
          type="button"
          onClick={() => openRecord(record)}
          aria-label={`Open the payment of order ${orderNumberLabel(record.order.orderNumber)}`}
          className="focus-ring rounded-sm font-medium text-ink underline decoration-ink-subtle decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:decoration-ink"
        >
          {orderNumberLabel(record.order.orderNumber)}
        </button>
      ),
    },
    {
      key: "customerName",
      header: "Customer",
      sortable: true,
      render: (record) => (
        <div className="flex flex-col">
          <span className="text-ink">{record.order.customerName}</span>
          <span className="text-xs text-ink-muted">
            {record.order.primaryPhone}
          </span>
        </div>
      ),
    },
    {
      key: "status",
      header: "Payment Status",
      sortable: true,
      render: (record) => <PaymentStatusBadge status={record.status} />,
    },
    {
      key: "orderValue",
      header: "Order Value",
      align: "right",
      className: "tabular-nums",
      render: (record) =>
        record.order.orderValue ? formatAED(record.order.orderValue) : dash,
    },
    {
      key: "paymentMethod",
      header: "Payment Method",
      render: (record) => record.order.paymentMethod ?? dash,
    },
    {
      key: "awbNumber",
      header: "AWB",
      className: "tabular-nums",
      render: (record) => record.order.awbNumber ?? dash,
    },
    {
      key: "courier",
      header: "Courier",
      render: (record) => record.order.courier ?? dash,
    },
    {
      key: "deliveredAt",
      header: "Delivered",
      sortable: true,
      className: "tabular-nums",
      render: (record) =>
        record.order.deliveredAt ? stamp(record.order.deliveredAt) : dash,
    },
    {
      key: "statusChangedAt",
      header: "Updated",
      sortable: true,
      className: "tabular-nums",
      render: (record) => stamp(record.statusChangedAt),
    },
    {
      key: "actions",
      header: "Actions",
      render: (record) => (
        <Tooltip content="View Details">
          <IconButton
            aria-label="View Details"
            onClick={() => openRecord(record)}
          >
            <IconEye size={18} stroke={1.75} aria-hidden="true" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const narrowed =
    state.status.length + state.paymentMethod.length + state.courier.length >
      0 || state.q !== "";
  const reset = () => {
    setSearch("");
    update({
      status: [],
      paymentMethod: [],
      courier: [],
      q: "",
      page: 1,
      sort: DEFAULT_ACCOUNTS_SORT.key,
      direction: DEFAULT_ACCOUNTS_SORT.direction,
    });
  };

  return (
    <>
      <TablePageLayout
        title="Accounts"
        tableLabel="Accounts records table"
        toolbarActions={
          <>
            <ToolbarSearch
              value={search}
              onChange={setSearch}
              placeholder="Search order #, customer, phone or AWB"
            />
            <FilterPanel
              title="Filters"
              fields={fields}
              activeCount={
                [state.status, state.paymentMethod, state.courier].filter(
                  (chosen) => chosen.length > 0,
                ).length
              }
              valueOf={(key) =>
                key === "status" || key === "paymentMethod" || key === "courier"
                  ? state[key]
                  : []
              }
              onChange={(key, next) => {
                const values = Array.isArray(next) ? next : [];
                if (key === "status") {
                  update({
                    status: PAYMENT_STATUSES.filter((status) =>
                      values.includes(status),
                    ),
                    page: 1,
                  });
                } else if (key === "paymentMethod" || key === "courier") {
                  update({ [key]: values, page: 1 });
                }
              }}
              onClear={() =>
                update({ status: [], paymentMethod: [], courier: [], page: 1 })
              }
            />
          </>
        }
        summary={
          <AccountsSummaryCards
            status={state.status}
            summary={counts.summary}
            isError={counts.isError}
            onRetry={counts.retry}
            onFilter={(status) => update({ status, page: 1 })}
          />
        }
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
          getRowId={(record) => record.id}
          sort={{ key: state.sort, direction: state.direction }}
          onSortChange={(sort) => {
            if (isAccountsSortKey(sort.key)) {
              update({ sort: sort.key, direction: sort.direction, page: 1 });
            }
          }}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={IconReceipt}
              title={
                narrowed ? "No matching records" : "No delivered orders yet"
              }
              description={
                narrowed
                  ? "Try other filters or another search."
                  : "An order appears here when Logistics marks it as delivered."
              }
              action={
                narrowed ? (
                  <Button variant="secondary" onClick={reset}>
                    Clear filters
                  </Button>
                ) : undefined
              }
            />
          }
          errorState={
            error ? (
              <ErrorState
                title="Couldn’t load the records"
                description={recordsLoadError(error.status)}
                onRetry={error.status === 400 ? reset : retry}
              />
            ) : undefined
          }
        />
      </TablePageLayout>

      {open && (
        <AccountsRecordDrawer
          record={open}
          onClose={() => {
            setSelected(null);
            update({ record: null });
          }}
          onRecordChange={(next) => {
            setSelected(next);
            setReloadToken((token) => token + 1);
          }}
        />
      )}
    </>
  );
}

/**
 * The Accounts dashboard's counts (client specification §10) above the list: the delivered orders
 * the filters select, then how many hold each payment status. Database counts from
 * `GET /accounts/records/summary` under every filter but the status filter, so the status cells
 * add up to All delivered orders whichever status is chosen. The cells are the status filter
 * itself, as on the Logistics screen: a status chooses it alone, choosing it again — or All —
 * clears it. Amounts — outstanding, collection percentage — wait for the client's payment rules.
 */
function AccountsSummaryCards({
  status,
  summary,
  isError,
  onRetry,
  onFilter,
}: {
  /** The status filter in force; empty is none. */
  status: readonly PaymentStatus[];
  summary: AccountsSummary | null;
  isError: boolean;
  onRetry: () => void;
  onFilter: (status: PaymentStatus[]) => void;
}) {
  if (!summary && isError) {
    return (
      <p role="alert" className="text-sm text-ink-muted">
        Couldn’t load the counts.{" "}
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
  return (
    <section aria-label="Payment counts">
      <StatStrip
        label="Delivered orders by payment status"
        items={[
          {
            key: "ALL",
            label: "All delivered orders",
            value: summary.total.toLocaleString("en-AE"),
            pressed: !filtered,
            onClick: () => onFilter([]),
          },
          ...PAYMENT_STATUSES.map((each) => {
            const pressed = filtered && status.includes(each);
            return {
              key: each,
              label: PAYMENT_STATUS_LABEL[each],
              value: summary.counts[each].toLocaleString("en-AE"),
              tone: PAYMENT_STATUS_TONE[each],
              pressed,
              onClick: () =>
                onFilter(pressed && status.length === 1 ? [] : [each]),
            };
          }),
        ]}
      />
    </section>
  );
}
