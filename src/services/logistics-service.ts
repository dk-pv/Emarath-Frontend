import { apiGet, apiPost } from "@/lib/api-client";
import {
  LOGISTICS_ORDERS_PATH,
  logisticsOrdersParams,
  shipmentActionRequest,
  type LogisticsOrdersQuery,
  type LogisticsStatus,
  type ShipmentActionInput,
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
 * Sends one shipment action. The response is the order read back after the move, with its new
 * status and its new `allowedActions`. The route, its role gate and the transition table decide;
 * a refusal comes back as the API's own 403, 404 or 409.
 */
export function runShipmentAction(
  orderId: string,
  input: ShipmentActionInput,
): Promise<LogisticsOrder> {
  const { path, body } = shipmentActionRequest(orderId, input);
  return apiPost<LogisticsOrder>(path, body);
}
