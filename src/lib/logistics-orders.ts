/**
 * The Logistics order queue (ADR-0085): its statuses, the request the list makes to
 * `GET /logistics/orders`, and the shipment actions the order panel can send.
 *
 * Import-free, so its self-check (`logistics-orders.check.ts`) compiles with plain tsc.
 */

/**
 * Every status an order can hold, in the order an order moves through them: the client
 * specification's Logistics pipeline (§6) plus RTO, which the client added as a status of its
 * own (CD-4). The backend's transition table decides which moves are legal; this is only the
 * vocabulary.
 */
export const LOGISTICS_STATUSES = [
  "INITIAL",
  "QC_VERIFIED",
  "QC_REJECTED",
  "DISPATCHED",
  "DELIVERED",
  "CANCELLED",
  "RTO",
] as const;

export type LogisticsStatus = (typeof LOGISTICS_STATUSES)[number];

/** The names the specification gives the statuses (§6); RTO keeps the client's acronym. */
export const LOGISTICS_STATUS_LABEL: Record<LogisticsStatus, string> = {
  INITIAL: "Initial",
  QC_VERIFIED: "QC Verified",
  QC_REJECTED: "QC Rejected",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
  RTO: "RTO",
};

/** A status's label, or the raw value for one this build does not know yet — never blank. */
export function logisticsStatusLabel(status: string): string {
  return LOGISTICS_STATUS_LABEL[status as LogisticsStatus] ?? status;
}

/** "#1001" — how an order number is shown, and a form the search also accepts. */
export function orderNumberLabel(orderNumber: number): string {
  return `#${orderNumber}`;
}

export const LOGISTICS_ORDERS_PATH = "/logistics/orders";

export type LogisticsOrdersQuery = {
  page: number;
  size: number;
  status?: LogisticsStatus;
  search?: string;
};

/** Only what narrows the list is sent: no status means every status, no search none. */
export function logisticsOrdersParams(
  query: LogisticsOrdersQuery,
): URLSearchParams {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.status) params.set("status", query.status);
  const search = query.search?.trim();
  if (search) params.set("search", search);
  return params;
}

/**
 * The actions this screen has a control for, in the order it shows them. Which of them apply
 * to an order and its caller is the backend's call alone (`allowedActions` on every order,
 * ADR-0085): the UI never works it out from role or status. Any other action the backend lists
 * is left alone rather than guessed at.
 */
export const SHIPMENT_ACTIONS = [
  "DISPATCH",
  "DELIVER",
  "CANCEL",
  "RTO",
] as const;

export type ShipmentAction = (typeof SHIPMENT_ACTIONS)[number];

export const SHIPMENT_ACTION_LABEL: Record<ShipmentAction, string> = {
  DISPATCH: "Dispatch",
  DELIVER: "Mark as delivered",
  CANCEL: "Cancel order",
  RTO: "Mark as RTO",
};

/** The controls to render: the backend's list, narrowed to what this screen implements. */
export function renderableActions(
  allowedActions: readonly string[],
): ShipmentAction[] {
  return SHIPMENT_ACTIONS.filter((action) => allowedActions.includes(action));
}

/** The backend DTOs' limits (`DispatchOrderDto`, `OrderReasonDto`), so the form never exceeds them. */
export const AWB_MAX_LENGTH = 64;
export const COURIER_MAX_LENGTH = 64;
export const REASON_MAX_LENGTH = 500;

/** What one action sends, field for field as its backend DTO defines it. */
export type ShipmentActionInput =
  | { action: "DISPATCH"; awbNumber: string; courier: string }
  | { action: "DELIVER" }
  | { action: "CANCEL" | "RTO"; reason: string };

/**
 * The request for one action: `POST /logistics/orders/:id/<action>`. Only the AWB is required
 * (at dispatch); the courier and the cancel or RTO reason are optional in the backend, so a
 * blank one is left out rather than sent empty.
 */
export function shipmentActionRequest(
  orderId: string,
  input: ShipmentActionInput,
): { path: string; body: Record<string, string> } {
  const path = `${LOGISTICS_ORDERS_PATH}/${orderId}/${input.action.toLowerCase()}`;
  const optional = (key: string, value: string) => {
    const trimmed = value.trim();
    return trimmed ? { [key]: trimmed } : {};
  };
  switch (input.action) {
    case "DISPATCH":
      return {
        path,
        body: {
          awbNumber: input.awbNumber.trim(),
          ...optional("courier", input.courier),
        },
      };
    case "DELIVER":
      return { path, body: {} };
    case "CANCEL":
    case "RTO":
      return { path, body: optional("reason", input.reason) };
  }
}

/** The one rule the Dispatch form checks itself: the backend refuses a blank AWB. */
export function dispatchAwbError(awbNumber: string): string | undefined {
  return awbNumber.trim()
    ? undefined
    : "Enter the AWB / tracking number — it is required to dispatch.";
}

/**
 * Whether a failed action means the order or the caller's rights have moved on since the panel
 * loaded — a 409 (the order is no longer where the action starts), a 403 (the caller may not
 * take it now) or a 404 — so the order is read again. Nothing is ever retried. Other failures
 * (a 400, a dropped connection, a 5xx) leave the panel as it was.
 */
export function refetchAfterFailure(status: number | undefined): boolean {
  return status === 403 || status === 404 || status === 409;
}
