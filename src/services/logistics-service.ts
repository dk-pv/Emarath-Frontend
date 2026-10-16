import { apiGet, apiPatch, apiPost } from "@/lib/api-client";
import {
  LOGISTICS_FILTER_OPTIONS_PATH,
  LOGISTICS_ORDERS_PATH,
  LOGISTICS_SCHEDULE_PATH,
  LOGISTICS_SUMMARY_PATH,
  logisticsFilterParams,
  logisticsOrdersParams,
  orderActionRequest,
  type DeliveryBucket,
  type LogisticsDeliverySchedule,
  type LogisticsFilterOptions,
  type LogisticsFilters,
  type LogisticsOrdersQuery,
  type LogisticsStatus,
  type LogisticsSummary,
  type OrderActionInput,
} from "@/lib/logistics-orders";
import type { ListResult } from "@/types";

/**
 * One order as the API returns it (ADR-0085). The customer and order fields are the snapshot
 * taken when the lead was won; money and quantities are decimal strings, never floats.
 */
export type LogisticsOrder = {
  id: string;
  orderNumber: number;
  leadId: string;
  status: LogisticsStatus;
  statusChangedAt: string;
  convertedAt: string;
  convertedById: string | null;
  customerName: string;
  primaryPhone: string;
  secondaryPhone: string | null;
  email: string | null;
  country: string | null;
  state: string | null;
  city: string | null;
  street: string | null;
  nationalCode: string | null;
  product: string | null;
  productQty: string | null;
  product2: string | null;
  product2Qty: string | null;
  orderValue: string | null;
  paymentMethod: string | null;
  qcDecidedAt: string | null;
  qcRemarks: string | null;
  awbNumber: string | null;
  courier: string | null;
  dispatchedAt: string | null;
  deliveredAt: string | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  rtoAt: string | null;
  rtoReason: string | null;
  /** The planned delivery day, `YYYY-MM-DD` — a calendar day, never put through a `Date`. */
  deliveryDate: string | null;
  /**
   * Where that date stands on the business day, decided by the backend in the business timezone
   * (ADR-0094). Null for a past date whose delivery already has an outcome.
   */
  deliveryBucket: DeliveryBucket | null;
  /**
   * What this caller may do to the order now, decided by the backend. Strings, not a closed
   * union: the backend may list an action this screen has no control for, and that is ignored.
   */
  allowedActions: readonly string[];
};

/**
 * One page of orders, newest first. Scoped server-side: Logistics reads every order, a sales
 * role only its own converted leads' — the list shows exactly what comes back.
 */
export function fetchLogisticsOrders(
  query: LogisticsOrdersQuery,
  signal?: AbortSignal,
): Promise<ListResult<LogisticsOrder>> {
  return apiGet<ListResult<LogisticsOrder>>(
    LOGISTICS_ORDERS_PATH,
    logisticsOrdersParams(query),
    signal,
  );
}

/**
 * The counts per status, country and city under the list's scope and every one of its filters,
 * its statuses included, but never its page or sort — database counts, so the List, the
 * Pipeline and the numbers above them agree.
 */
export function fetchLogisticsSummary(
  filters: LogisticsFilters,
  signal?: AbortSignal,
): Promise<LogisticsSummary> {
  return apiGet<LogisticsSummary>(
    LOGISTICS_SUMMARY_PATH,
    logisticsFilterParams(filters),
    signal,
  );
}

/**
 * The delivery schedule: counts per delivery bucket and per day for the coming two weeks, under
 * the list's scope and every filter but the delivery date's own, which the API never applies.
 */
export function fetchLogisticsDeliverySchedule(
  filters: LogisticsFilters,
  signal?: AbortSignal,
): Promise<LogisticsDeliverySchedule> {
  return apiGet<LogisticsDeliverySchedule>(
    LOGISTICS_SCHEDULE_PATH,
    logisticsFilterParams(filters),
    signal,
  );
}

/** The countries and cities in the caller's own orders — what the filter offers. */
export function fetchLogisticsFilterOptions(
  signal?: AbortSignal,
): Promise<LogisticsFilterOptions> {
  return apiGet<LogisticsFilterOptions>(
    LOGISTICS_FILTER_OPTIONS_PATH,
    undefined,
    signal,
  );
}

/** One order as it stands now — how the panel catches up after an action was refused. */
export function fetchLogisticsOrder(
  id: string,
  signal?: AbortSignal,
): Promise<LogisticsOrder> {
  return apiGet<LogisticsOrder>(
    `${LOGISTICS_ORDERS_PATH}/${id}`,
    undefined,
    signal,
  );
}

/**
 * Sends one order action — a status move or one of the Logistics Manager's corrections. The
 * response is the order read back after it, with its new status and its new `allowedActions`.
 * The route, its role gate, the caller's scope and the transition table decide; a refusal comes
 * back as the API's own 400, 403, 404 or 409.
 */
export function runOrderAction(
  orderId: string,
  input: OrderActionInput,
): Promise<LogisticsOrder> {
  const { method, path, body } = orderActionRequest(orderId, input);
  return method === "PATCH"
    ? apiPatch<LogisticsOrder>(path, body)
    : apiPost<LogisticsOrder>(path, body);
}
