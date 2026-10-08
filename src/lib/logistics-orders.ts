/**
 * The Logistics order queue (ADR-0085): its statuses, the request the list makes to
 * `GET /logistics/orders`, and the actions the order panel can send.
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
 * The actions this screen has a control for — every one the backend can offer (client
 * clarification of 2026-10-01) — in the order the panel's footer shows them: secondary steps
 * first, the forward step last, where the primary button sits. Which of them apply to an order
 * and its caller is the backend's call alone (`allowedActions` on every order, ADR-0085): the
 * UI never works it out from role or status. Any other action the backend lists is left alone
 * rather than guessed at.
 */
export const ORDER_ACTIONS = [
  "QC_REJECT",
  "CANCEL",
  "RTO",
  "CORRECT_AWB",
  "EDIT",
  "RESUBMIT",
  "QC_VERIFY",
  "DELIVER",
  "DISPATCH",
] as const;

export type OrderAction = (typeof ORDER_ACTIONS)[number];

export const ORDER_ACTION_LABEL: Record<OrderAction, string> = {
  QC_VERIFY: "QC Verify",
  QC_REJECT: "QC Reject",
  RESUBMIT: "Resubmit to QC",
  EDIT: "Edit order",
  CORRECT_AWB: "Correct AWB",
  DISPATCH: "Dispatch",
  DELIVER: "Mark as delivered",
  CANCEL: "Cancel order",
  RTO: "Mark as RTO",
};

/** The controls to render: the backend's list, narrowed to what this screen implements. */
export function renderableActions(
  allowedActions: readonly string[],
): OrderAction[] {
  return ORDER_ACTIONS.filter((action) => allowedActions.includes(action));
}

/** The backend DTOs' limits, so a form never exceeds them. */
export const AWB_MAX_LENGTH = 64;
export const COURIER_MAX_LENGTH = 64;
export const REASON_MAX_LENGTH = 500;
export const QC_REMARKS_MAX_LENGTH = 2000;

/**
 * The order data the Logistics Manager may correct after QC (`UpdateLogisticsOrderDto`), with
 * the labels the order panel already uses and the columns' limits. Name and phone cannot be
 * blanked; quantities and the value must be numbers. Order Value and Payment Method are
 * editable pending open client question Q17 — if refused, they leave this list and the
 * backend's `EDITABLE_ORDER_FIELDS` together.
 */
export const ORDER_EDIT_FIELDS = [
  {
    key: "customerName",
    label: "Customer Name",
    maxLength: 180,
    required: true,
  },
  {
    key: "primaryPhone",
    label: "Primary Phone",
    maxLength: 32,
    required: true,
  },
  { key: "secondaryPhone", label: "Secondary Phone", maxLength: 32 },
  { key: "email", label: "Email", maxLength: 180 },
  { key: "street", label: "Street", maxLength: 240 },
  { key: "city", label: "City", maxLength: 120 },
  { key: "state", label: "State", maxLength: 120 },
  { key: "country", label: "Country", maxLength: 64 },
  { key: "nationalCode", label: "National Code", maxLength: 240 },
  { key: "product", label: "Product", maxLength: 180 },
  { key: "productQty", label: "QTY", maxLength: 14, numeric: true },
  { key: "product2", label: "Product 2", maxLength: 180 },
  {
    key: "product2Qty",
    label: "QTY of Product 2",
    maxLength: 14,
    numeric: true,
  },
  { key: "orderValue", label: "Order Value", maxLength: 14, numeric: true },
  { key: "paymentMethod", label: "Payment Method", maxLength: 64 },
] as const;

export type OrderEditField = (typeof ORDER_EDIT_FIELDS)[number]["key"];
export type OrderEditValues = Record<OrderEditField, string>;

/** The form's starting values: the order's own, blank where it has none. */
export function orderEditValues(
  order: Record<OrderEditField, string | null>,
): OrderEditValues {
  return Object.fromEntries(
    ORDER_EDIT_FIELDS.map(({ key }) => [key, order[key] ?? ""]),
  ) as OrderEditValues;
}

/** Only what changed is sent; a field emptied is sent blank, which the backend clears. */
export function orderEditChanges(
  initial: OrderEditValues,
  draft: OrderEditValues,
): Partial<OrderEditValues> {
  return Object.fromEntries(
    ORDER_EDIT_FIELDS.filter(
      ({ key }) => draft[key].trim() !== initial[key].trim(),
    ).map(({ key }) => [key, draft[key].trim()]),
  );
}

/** The backend's rule for a `Decimal(12, 2)` column: ten integer digits, two decimals. */
const NUMBER = /^-?\d{1,10}(\.\d{1,2})?$/;

/** What the form refuses itself — the backend's rules for these fields. */
export function orderEditErrors(
  draft: OrderEditValues,
): Partial<Record<OrderEditField, string>> {
  const errors: Partial<Record<OrderEditField, string>> = {};
  for (const field of ORDER_EDIT_FIELDS) {
    const value = draft[field.key].trim();
    if ("required" in field && !value) {
      errors[field.key] = `${field.label} is required.`;
    } else if ("numeric" in field && value && !NUMBER.test(value)) {
      errors[field.key] =
        `${field.label} must be a number with at most 10 digits and 2 decimals.`;
    }
  }
  return errors;
}

/** What one action sends, field for field as its backend DTO defines it. */
export type OrderActionInput =
  | { action: "QC_VERIFY" | "QC_REJECT" | "RESUBMIT"; remarks: string }
  | { action: "DISPATCH"; awbNumber: string; courier: string }
  | { action: "DELIVER" }
  | { action: "CANCEL" | "RTO"; reason: string }
  | { action: "CORRECT_AWB"; awbNumber: string }
  | { action: "EDIT"; changes: Partial<OrderEditValues> };

/**
 * The request for one action. Status moves are `POST /logistics/orders/:id/<route>`; the
 * Manager's two corrections are `PATCH /logistics/orders/:id` (the order's data) and
 * `PATCH /logistics/orders/:id/awb`. Required values are sent trimmed; an optional note or
 * courier left blank is left out rather than sent empty.
 */
export function orderActionRequest(
  orderId: string,
  input: OrderActionInput,
): {
  method: "POST" | "PATCH";
  path: string;
  body: Record<string, string>;
} {
  const order = `${LOGISTICS_ORDERS_PATH}/${orderId}`;
  const post = (route: string, body: Record<string, string> = {}) => ({
    method: "POST" as const,
    path: `${order}/${route}`,
    body,
  });
  const optional = (key: string, value: string) => {
    const trimmed = value.trim();
    return trimmed ? { [key]: trimmed } : {};
  };
  switch (input.action) {
    case "QC_VERIFY":
      return post("qc-verify", optional("remarks", input.remarks));
    case "QC_REJECT":
      return post("qc-reject", { remarks: input.remarks.trim() });
    case "RESUBMIT":
      return post("resubmit", optional("remarks", input.remarks));
    case "DISPATCH":
      return post("dispatch", {
        awbNumber: input.awbNumber.trim(),
        ...optional("courier", input.courier),
      });
    case "DELIVER":
      return post("deliver");
    case "CANCEL":
      return post("cancel", { reason: input.reason.trim() });
    case "RTO":
      return post("rto", { reason: input.reason.trim() });
    case "CORRECT_AWB":
      return {
        method: "PATCH",
        path: `${order}/awb`,
        body: { awbNumber: input.awbNumber.trim() },
      };
    case "EDIT":
      return {
        method: "PATCH",
        path: order,
        body: input.changes as Record<string, string>,
      };
  }
}

/** The AWB rule both AWB forms check themselves — the backend's: it may not be blank. */
export function dispatchAwbError(awbNumber: string): string | undefined {
  return awbNumber.trim()
    ? undefined
    : "Enter the AWB / tracking number — it is required.";
}

/** A mandatory reason (QC rejection, cancellation, RTO) left blank. */
export function requiredReasonError(text: string): string | undefined {
  return text.trim() ? undefined : "Enter a reason — it is required.";
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
