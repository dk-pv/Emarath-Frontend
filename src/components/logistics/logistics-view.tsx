"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { IconLayoutKanban, IconList } from "@tabler/icons-react";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import {
  SegmentedControl,
  type SegmentedOption,
} from "@/components/ui/SegmentedControl";
import { useToast } from "@/components/ui/Toast";
import { LogisticsBoard } from "@/components/logistics/logistics-board";
import {
  LogisticsDeliverySchedule,
  useBusinessDayRollover,
  useDeliverySchedule,
} from "@/components/logistics/logistics-delivery-schedule";
import {
  LogisticsFilterPanel,
  type LogisticsChosenFilters,
} from "@/components/logistics/logistics-filter-panel";
import { LogisticsListView } from "@/components/logistics/logistics-list-view";
import { LogisticsOrderDrawer } from "@/components/logistics/logistics-order-drawer";
import {
  LogisticsSummaryCards,
  useLogisticsSummary,
} from "@/components/logistics/logistics-summary-cards";
import {
  DEFAULT_PAGE_SIZE,
  PAGE_SIZE_OPTIONS,
  SEARCH_DEBOUNCE_MS,
  SEARCH_MAX_LENGTH,
} from "@/constants/table";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { isAbortError } from "@/lib/api-client";
import {
  DEFAULT_LOGISTICS_SORT,
  logisticsFilterParams,
  logisticsUrlParams,
  parseLogisticsUrl,
  readLogisticsFilters,
  type LogisticsUrlState,
  type LogisticsView as View,
} from "@/lib/logistics-orders";
import {
  fetchLogisticsOrder,
  type LogisticsOrder,
} from "@/services/logistics-service";

const LIMITS = {
  pageSizes: PAGE_SIZE_OPTIONS,
  defaultSize: DEFAULT_PAGE_SIZE,
  searchMax: SEARCH_MAX_LENGTH,
};

const VIEWS: readonly SegmentedOption<View>[] = [
  { value: "list", label: "List", icon: IconList },
  { value: "pipeline", label: "Pipeline", icon: IconLayoutKanban },
];

/**
 * The screen's state, read from the address and written back to it. Writes go through the
 * native History API, which Next's router keeps `useSearchParams` in step with, so a filter
 * change costs no server round trip and adds no history entry.
 */
function useLogisticsUrl() {
  const params = useSearchParams();
  const pathname = usePathname();
  const state = useMemo(() => parseLogisticsUrl(params, LIMITS), [params]);
  const update = useCallback(
    (changes: Partial<LogisticsUrlState>) => {
      // From the address as it is now, so two updates in one event both land.
      const current = parseLogisticsUrl(
        new URLSearchParams(window.location.search),
        LIMITS,
      );
      const query = logisticsUrlParams(
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

const NO_FILTERS: LogisticsChosenFilters = {
  status: [],
  delivery: [],
  deliveryOn: null,
  country: [],
  city: [],
};

/**
 * The Logistics screen (ADR-0085): the caller's orders as a List or as a Pipeline board, toggled
 * at the top. Both views read the same `GET /logistics/orders` under the same scope, filters,
 * search and sort, and the counts above them come from the database under those same filters —
 * the board is another view of the same records, never a copy. Either view opens the one order
 * panel, whose actions are the backend's `allowedActions`; after one, the views and the counts
 * are read again.
 *
 * The view, filters, search, page, sort and open order live in the address, so a reload or a
 * shared link — the Lead Detail page links an order this way — opens the screen as it was. Above
 * the counts, the delivery schedule (ADR-0094) chooses a delivery bucket or day for both views.
 */
export function LogisticsView() {
  const [state, update] = useLogisticsUrl();
  const { toast } = useToast();

  // Keyed by the request they make, so the views and the counts read again only when a filter's
  // values change — not when the page, the sort or the open order does.
  const filterQuery = logisticsFilterParams({
    status: state.status,
    delivery: state.delivery,
    deliveryOn: state.deliveryOn ?? undefined,
    country: state.country,
    city: state.city,
    search: state.q,
  }).toString();
  const filters = useMemo(
    () => readLogisticsFilters(new URLSearchParams(filterQuery)),
    [filterQuery],
  );

  // The box follows every keystroke; the address, and every request, the settled value. A new
  // search starts from the first page. Only a change of the settled value is written, so a reset
  // that cleared the address is not undone by a value still waiting out its debounce.
  const [search, setSearch] = useState(state.q);
  const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
  const lastSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (debouncedSearch === lastSearch.current) return;
    lastSearch.current = debouncedSearch;
    update({ q: debouncedSearch.trim(), page: 1 });
  }, [debouncedSearch, update]);

  const [reloadToken, setReloadToken] = useState(0);
  const counts = useLogisticsSummary(filters, reloadToken);
  const schedule = useDeliverySchedule(filters, reloadToken);
  // When the business day turns over, everything is read again: buckets are decided when read.
  useBusinessDayRollover(
    (counts.summary ?? schedule.schedule)?.businessDay.timeZone,
    () => setReloadToken((token) => token + 1),
  );

  // The open order: the row or card that was clicked, or — on arrival by link — read from the
  // API, which refuses an order outside the caller's scope.
  const [selected, setSelected] = useState<LogisticsOrder | null>(null);
  useEffect(() => {
    if (!state.order || selected?.id === state.order) return;
    const controller = new AbortController();
    fetchLogisticsOrder(state.order, controller.signal)
      .then(setSelected)
      .catch((error: unknown) => {
        if (isAbortError(error)) return;
        toast({
          title: "Couldn’t open that order",
          description: "It doesn’t exist, or it isn’t one you can see.",
          tone: "danger",
        });
        update({ order: null });
      });
    return () => controller.abort();
  }, [state.order, selected?.id, toast, update]);
  const open = selected && selected.id === state.order ? selected : null;

  const openOrder = useCallback(
    (order: LogisticsOrder) => {
      setSelected(order);
      update({ order: order.id });
    },
    [update],
  );

  const toggle = (
    <SegmentedControl
      aria-label="Logistics view"
      options={VIEWS}
      value={state.view}
      onChange={(view) => update({ view })}
    />
  );
  const toolbarActions = (
    <>
      <ToolbarSearch
        value={search}
        onChange={setSearch}
        placeholder="Search order #, customer, phone or AWB"
      />
      {/* Any change of filter starts again from the first page. */}
      <LogisticsFilterPanel
        value={state}
        businessDay={counts.summary?.businessDay}
        reloadToken={reloadToken}
        onChange={(changes) => update({ ...changes, page: 1 })}
        onClear={() => update({ ...NO_FILTERS, page: 1 })}
      />
    </>
  );
  const summary = (
    <div className="flex flex-col gap-3">
      {/* Choosing a bucket or a day is a Delivery Date filter change, so it starts again from
          the first page like any other. */}
      <LogisticsDeliverySchedule
        choice={{ delivery: state.delivery, deliveryOn: state.deliveryOn }}
        schedule={schedule.schedule}
        isError={schedule.isError}
        onRetry={schedule.retry}
        onChoose={(choice) => update({ ...choice, page: 1 })}
      />
      <LogisticsSummaryCards
        status={filters.status ?? []}
        summary={counts.summary}
        isError={counts.isError}
        onRetry={counts.retry}
      />
    </div>
  );

  return (
    <>
      {state.view === "pipeline" ? (
        <LogisticsBoard
          filters={filters}
          sort={state.sort}
          direction={state.direction}
          toolbarLeft={toggle}
          toolbarActions={toolbarActions}
          summary={summary}
          reloadToken={reloadToken}
          onOpen={openOrder}
        />
      ) : (
        <LogisticsListView
          state={state}
          filters={filters}
          update={update}
          toolbarLeft={toggle}
          toolbarActions={toolbarActions}
          summary={summary}
          reloadToken={reloadToken}
          onOpen={openOrder}
          onReset={() => {
            setSearch("");
            update({
              ...NO_FILTERS,
              q: "",
              page: 1,
              sort: DEFAULT_LOGISTICS_SORT.key,
              direction: DEFAULT_LOGISTICS_SORT.direction,
            });
          }}
        />
      )}

      {open && (
        <LogisticsOrderDrawer
          order={open}
          onClose={() => {
            setSelected(null);
            update({ order: null });
          }}
          onOrderChange={(next) => {
            setSelected(next);
            setReloadToken((token) => token + 1);
          }}
        />
      )}
    </>
  );
}
