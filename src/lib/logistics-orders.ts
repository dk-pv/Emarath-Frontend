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

/**
 * How each status reads on screen. INITIAL is shown by what it means to Logistics — the order is
 * waiting for QC, the client dashboard's "QC pending" (§10) — while the status itself, in the API
 * and the database, stays INITIAL (§6). The rest are the specification's names; RTO keeps the
 * client's acronym.
 */
export const LOGISTICS_STATUS_LABEL: Record<LogisticsStatus, string> = {
  INITIAL: "QC Pending",
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

/** The Logistics order a lead converted into, as a lead response carries it. */
export type LeadLogisticsOrder = {
  id: string;
  orderNumber: number;
  status: LogisticsStatus;
  /** Its planned delivery day, `YYYY-MM-DD` (ADR-0094), or null when none is set. */
  deliveryDate: string | null;
};

/** The Logistics screen with this order's panel open — where a lead links to its order. */
export function logisticsOrderHref(orderId: string): string {
  return `/logistics?order=${encodeURIComponent(orderId)}`;
}

/**
 * Why a lead's Delete, Convert, status and pipeline controls are off, or null when they are
 * not. Once a lead has a Logistics order the server refuses all four (409): the order owns
 * the lead's status and pipeline, and the lead is kept. A lead with no order — a WON lead
 * from before ADR-0085 included — keeps every control.
 */
export function orderLockReason(
  order: LeadLogisticsOrder | null | undefined,
): string | null {
  return order
    ? `Logistics order ${orderNumberLabel(order.orderNumber)} manages this lead’s status and pipeline, and the lead can’t be deleted.`
    : null;
}

export const LOGISTICS_ORDERS_PATH = "/logistics/orders";

/** The queue's counts per status (`GET /logistics/orders/summary`). */
export const LOGISTICS_SUMMARY_PATH = `${LOGISTICS_ORDERS_PATH}/summary`;

/** The QC-verified orders under the filters, as a CSV for the delivery partner (3PL-01). */
export const LOGISTICS_EXPORT_PATH = `${LOGISTICS_ORDERS_PATH}/export`;

/** The columns the queue can be ordered by — the backend's whitelist, nothing else. */
export const LOGISTICS_SORT_KEYS = [
  "orderNumber",
  "customerName",
  "status",
  "convertedAt",
  "statusChangedAt",
  "deliveryDate",
] as const;

export type LogisticsSortKey = (typeof LOGISTICS_SORT_KEYS)[number];

export type LogisticsSortDirection = "asc" | "desc";

/** The queue's order before anyone sorts it: newest first, as the API defaults. */
export const DEFAULT_LOGISTICS_SORT: {
  key: LogisticsSortKey;
  direction: LogisticsSortDirection;
} = { key: "convertedAt", direction: "desc" };

export function isLogisticsSortKey(value: string): value is LogisticsSortKey {
  return (LOGISTICS_SORT_KEYS as readonly string[]).includes(value);
}

/** Orders per Pipeline column per request; "Load more" asks for the next page. */
export const BOARD_PAGE_SIZE = 20;

/**
 * Where an order's delivery date stands on the business day (ADR-0094). The backend decides — in
 * the business timezone, never this browser's — and sends each order's bucket with it.
 */
export const DELIVERY_BUCKETS = [
  "today",
  "tomorrow",
  "future",
  "overdue",
  "none",
] as const;

export type DeliveryBucket = (typeof DELIVERY_BUCKETS)[number];

export const DELIVERY_BUCKET_LABEL: Record<DeliveryBucket, string> = {
  today: "Today",
  tomorrow: "Tomorrow",
  future: "Future-Dated",
  overdue: "Overdue",
  none: "No Delivery Date",
};

/** The business day the API measured the buckets against, and its IANA timezone. */
export type BusinessDay = { timeZone: string; today: string; tomorrow: string };

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Whether `value` is a real calendar day written `YYYY-MM-DD` in 2000–2099 — the backend's rule
 * for a delivery date. Checked on the parts, never through a local-time `Date`.
 */
export function isDateOnly(value: string): boolean {
  const match = DATE_ONLY.exec(value);
  if (!match) return false;
  const [year, month, day] = match.slice(1).map(Number);
  if (year < 2000 || year > 2099) return false;
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * `15-10-2026` — a date-only value in the app's date format, rearranged as text so no timezone
 * can move it a day (`formatDate` reads its input as an instant). Anything else is shown as is.
 */
export function formatDateOnly(value: string): string {
  const match = DATE_ONLY.exec(value);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : value;
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** `Thu` — a date-only value's weekday, from its calendar parts (UTC), so no timezone moves it. */
export function weekdayOf(value: string): string {
  const match = DATE_ONLY.exec(value);
  if (!match) return "";
  const [year, month, day] = match.slice(1).map(Number);
  return WEEKDAYS[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];
}

/**
 * The calendar day in `timeZone` at `now`, `YYYY-MM-DD` — only to notice that the business day has
 * turned over, so the screen can read again. The API alone decides which bucket an order is in.
 */
export function dayIn(timeZone: string, now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((each) => each.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}`;
}

/** The filter limits the backend's DTO sets: its columns' lengths and a value count. */
export const COUNTRY_MAX_LENGTH = 64;
export const CITY_MAX_LENGTH = 120;
export const STATE_MAX_LENGTH = 120;
export const MAX_FILTER_VALUES = 100;

/**
 * What narrows the orders: any of the chosen statuses, delivery buckets, countries, cities, states
 * (areas), delivery partners and sales executives (none chosen is no filter), and the search. The
 * List, every Pipeline column and the counts send the same filters.
 */
export type LogisticsFilters = {
  status?: readonly LogisticsStatus[];
  delivery?: readonly DeliveryBucket[];
  /** One delivery day, `YYYY-MM-DD` — like a bucket, an alternative within the Delivery Date filter. */
  deliveryOn?: string;
  country?: readonly string[];
  city?: readonly string[];
  /** The order's State — its country's first-level region (an Emirate, a province). */
  state?: readonly string[];
  /** The delivery partner: the courier recorded at dispatch. */
  courier?: readonly string[];
  /** User ids: orders whose lead is assigned to any of them now. */
  assignedAgent?: readonly string[];
  search?: string;
};

/** The filter keys sent as repeated values, in the order they are sent. */
const MULTI_FILTERS = [
  "status",
  "delivery",
  "country",
  "city",
  "state",
  "courier",
  "assignedAgent",
] as const;

export type LogisticsOrdersQuery = LogisticsFilters & {
  page: number;
  size: number;
  sort?: LogisticsSortKey;
  direction?: LogisticsSortDirection;
};

/** Only what narrows is sent, each chosen value as its own repeated key. */
export function logisticsFilterParams(
  filters: LogisticsFilters,
  params = new URLSearchParams(),
): URLSearchParams {
  for (const key of MULTI_FILTERS) {
    for (const value of filters[key] ?? []) params.append(key, value);
  }
  if (filters.deliveryOn) params.set("deliveryOn", filters.deliveryOn);
  const search = filters.search?.trim();
  if (search) params.set("search", search);
  return params;
}

/**
 * The filters a `logisticsFilterParams` request names — its inverse, so the request string can
 * key the filters: a change elsewhere in the address (the page, the open order) re-reads nothing.
 */
export function readLogisticsFilters(
  params: URLSearchParams,
): LogisticsFilters {
  const status = params.getAll("status");
  const delivery = params.getAll("delivery");
  const deliveryOn = params.get("deliveryOn") ?? "";
  return {
    status: LOGISTICS_STATUSES.filter((value) => status.includes(value)),
    delivery: DELIVERY_BUCKETS.filter((value) => delivery.includes(value)),
    deliveryOn: isDateOnly(deliveryOn) ? deliveryOn : undefined,
    country: params.getAll("country"),
    city: params.getAll("city"),
    state: params.getAll("state"),
    courier: params.getAll("courier"),
    assignedAgent: params.getAll("assignedAgent"),
    search: params.get("search") ?? undefined,
  };
}

export function logisticsOrdersParams(
  query: LogisticsOrdersQuery,
): URLSearchParams {
  const params = logisticsFilterParams(
    query,
    new URLSearchParams({ page: String(query.page), size: String(query.size) }),
  );
  if (query.sort) params.set("sort", query.sort);
  if (query.direction) params.set("direction", query.direction);
  return params;
}

/** How many orders hold one country, city or area value; `null` is an order with none recorded. */
export type RegionCount = { value: string | null; count: number };

/**
 * How many of the caller's orders the filters select: per status (every status, zero included)
 * and per country, city and area (the order's State, the Area filter's field), most first, none
 * recorded last.
 */
export type LogisticsSummary = {
  counts: Record<LogisticsStatus, number>;
  total: number;
  countries: RegionCount[];
  cities: RegionCount[];
  states: RegionCount[];
  /** The business day the delivery buckets were measured against. */
  businessDay: BusinessDay;
};

/** The delivery schedule's counts (`GET /logistics/orders/delivery-schedule`). */
export const LOGISTICS_SCHEDULE_PATH = `${LOGISTICS_ORDERS_PATH}/delivery-schedule`;

/** One day of the delivery schedule: its orders, and how many hold each status. */
export type DeliveryScheduleDay = {
  date: string;
  total: number;
  counts: Record<LogisticsStatus, number>;
};

/**
 * How many orders every filter but the delivery date's own selects: per bucket, and per day for
 * the coming two weeks from the business day's today. Each count is the List's total once that
 * bucket or day is chosen.
 */
export type LogisticsDeliverySchedule = {
  businessDay: BusinessDay;
  buckets: Record<DeliveryBucket, number>;
  days: DeliveryScheduleDay[];
};

/** The filters the schedule is read with: every one but the delivery date's, which it never applies. */
export function scheduleFilters(filters: LogisticsFilters): LogisticsFilters {
  return { ...filters, delivery: [], deliveryOn: undefined };
}

/** What the Delivery Date filter holds: any of the chosen buckets, or the one chosen day. */
export type DeliveryChoice = {
  delivery: DeliveryBucket[];
  deliveryOn: string | null;
};

export const NO_DELIVERY_CHOICE: DeliveryChoice = {
  delivery: [],
  deliveryOn: null,
};

/** Choosing a bucket on the schedule: that bucket alone. */
export function bucketChoice(bucket: DeliveryBucket): DeliveryChoice {
  return { delivery: [bucket], deliveryOn: null };
}

/**
 * Choosing a day: Today and Tomorrow as their buckets, so the choice moves on with the business
 * day as the client's "Tomorrow's Deliveries" does; any other day as itself.
 */
export function dayChoice(date: string, day: BusinessDay): DeliveryChoice {
  if (date === day.today) return bucketChoice("today");
  if (date === day.tomorrow) return bucketChoice("tomorrow");
  return { delivery: [], deliveryOn: date };
}

/** Whether the filter holds exactly `choice` — only then does the schedule show it as chosen. */
export function isDeliveryChoice(
  current: DeliveryChoice,
  choice: DeliveryChoice,
): boolean {
  return (
    current.deliveryOn === choice.deliveryOn &&
    current.delivery.length === choice.delivery.length &&
    choice.delivery.every((bucket) => current.delivery.includes(bucket))
  );
}

/** The values the filter offers (`GET /logistics/orders/filter-options`). */
export const LOGISTICS_FILTER_OPTIONS_PATH = `${LOGISTICS_ORDERS_PATH}/filter-options`;

/** A sales executive the filter offers: a user a caller's order's lead is assigned to. */
export type LogisticsAssigneeOption = { id: string; name: string };

export type LogisticsFilterOptions = {
  countries: string[];
  cities: string[];
  states: string[];
  couriers: string[];
  assignees: LogisticsAssigneeOption[];
};

/** The statuses a screen shows: the chosen ones, or every status when none is chosen. */
export function shownStatuses(
  status: readonly LogisticsStatus[],
): readonly LogisticsStatus[] {
  return status.length > 0 ? status : LOGISTICS_STATUSES;
}

/**
 * The three ways the screen shows the same orders: the List, the Pipeline board, and the Dashboard
 * of their counts, each count opening the List narrowed to it.
 */
export type LogisticsView = "list" | "pipeline" | "dashboard";

const VIEWS: readonly LogisticsView[] = ["list", "pipeline", "dashboard"];

/**
 * Everything the Logistics screen keeps in its address, so a reload or a shared link opens it
 * as it was: the view, the filters, the search, the page, the sort and the open order.
 */
export type LogisticsUrlState = {
  view: LogisticsView;
  status: LogisticsStatus[];
  delivery: DeliveryBucket[];
  deliveryOn: string | null;
  country: string[];
  city: string[];
  state: string[];
  courier: string[];
  assignedAgent: string[];
  q: string;
  page: number;
  size: number;
  sort: LogisticsSortKey;
  direction: LogisticsSortDirection;
  order: string | null;
};

/** The screen's own limits, passed in so this module stays import-free. */
export type LogisticsUrlLimits = {
  pageSizes: readonly number[];
  defaultSize: number;
  searchMax: number;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One value each, trimmed; a blank or over-long one — which could match no order — dropped. */
function filterValues(values: string[], maxLength: number): string[] {
  const kept = values
    .map((value) => value.trim())
    .filter((value) => value && value.length <= maxLength);
  return [...new Set(kept)].slice(0, MAX_FILTER_VALUES);
}

/**
 * Reads the screen's state from the address. Anything unknown or malformed falls back to its
 * default rather than reaching the API as a request it would refuse.
 */
export function parseLogisticsUrl(
  params: URLSearchParams,
  limits: LogisticsUrlLimits,
): LogisticsUrlState {
  const page = Number(params.get("page"));
  const size = Number(params.get("size"));
  const sort = params.get("sort") ?? "";
  const direction = params.get("direction");
  const order = params.get("order") ?? "";
  const statuses = params.getAll("status");
  const buckets = params.getAll("delivery");
  const deliveryOn = params.get("deliveryOn") ?? "";
  return {
    view: VIEWS.find((view) => view === params.get("view")) ?? "list",
    // In lifecycle order whatever the address's order, so one choice is always one address.
    status: LOGISTICS_STATUSES.filter((status) => statuses.includes(status)),
    delivery: DELIVERY_BUCKETS.filter((bucket) => buckets.includes(bucket)),
    deliveryOn: isDateOnly(deliveryOn) ? deliveryOn : null,
    country: filterValues(params.getAll("country"), COUNTRY_MAX_LENGTH),
    city: filterValues(params.getAll("city"), CITY_MAX_LENGTH),
    state: filterValues(params.getAll("state"), STATE_MAX_LENGTH),
    courier: filterValues(params.getAll("courier"), COURIER_MAX_LENGTH),
    assignedAgent: filterValues(params.getAll("assignedAgent"), 36).filter(
      (id) => UUID.test(id),
    ),
    q: (params.get("q") ?? "").trim().slice(0, limits.searchMax),
    page: Number.isSafeInteger(page) && page >= 1 ? page : 1,
    size: limits.pageSizes.includes(size) ? size : limits.defaultSize,
    sort: isLogisticsSortKey(sort) ? sort : DEFAULT_LOGISTICS_SORT.key,
    direction:
      direction === "asc" || direction === "desc"
        ? direction
        : DEFAULT_LOGISTICS_SORT.direction,
    order: UUID.test(order) ? order : null,
  };
}

/** The address for a state: only what differs from the defaults, so a plain visit stays plain. */
export function logisticsUrlParams(
  state: LogisticsUrlState,
  defaultSize: number,
): URLSearchParams {
  const params = new URLSearchParams();
  if (state.view !== "list") params.set("view", state.view);
  for (const key of MULTI_FILTERS) {
    for (const value of state[key]) params.append(key, value);
  }
  if (state.deliveryOn) params.set("deliveryOn", state.deliveryOn);
  const q = state.q.trim();
  if (q) params.set("q", q);
  if (state.page > 1) params.set("page", String(state.page));
  if (state.size !== defaultSize) params.set("size", String(state.size));
  if (
    state.sort !== DEFAULT_LOGISTICS_SORT.key ||
    state.direction !== DEFAULT_LOGISTICS_SORT.direction
  ) {
    params.set("sort", state.sort);
    params.set("direction", state.direction);
  }
  if (state.order) params.set("order", state.order);
  return params;
}

/**
 * What the screen says when orders can't be loaded. A refusal is not a dropped connection: a
 * 403 means the role has no access, a 400 means the address carried filters the API refused.
 */
export function ordersLoadError(status: number | undefined): string {
  if (status === 403) {
    return "Your role doesn’t have access to Logistics orders.";
  }
  if (status === 400) {
    return "The filters in this page’s address aren’t valid. Try again to clear them.";
  }
  return "Something went wrong while loading orders. Check your connection and try again.";
}

/**
 * The actions this screen has a control for — every one the backend can offer (client
 * clarification of 2026-10-01, and Sales' delivery date of Phase 2D) — in the order the panel's
 * footer shows them: secondary steps first, the forward step last, where the primary button
 * sits. Which of them apply to an order and its caller is the backend's call alone
 * (`allowedActions` on every order, ADR-0085): the UI never works it out from role or status.
 * Any other action the backend lists is left alone rather than guessed at.
 */
export const ORDER_ACTIONS = [
  "QC_REJECT",
  "CANCEL",
  "RTO",
  "CORRECT_AWB",
  "EDIT",
  "SET_DELIVERY_DATE",
  "CORRECT_DELIVERY_DATE",
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
  SET_DELIVERY_DATE: "Set delivery date",
  CORRECT_DELIVERY_DATE: "Correct delivery date",
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
  // The date follows this edit's rules (ADR-0094) and can be changed but not cleared: every order
  // must have one (client, 2026-10-17).
  { key: "deliveryDate", label: "Delivery Date", maxLength: 10, date: true },
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
    } else if ("date" in field && value && !isDateOnly(value)) {
      errors[field.key] = `${field.label} must be a real date.`;
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
  | { action: "EDIT"; changes: Partial<OrderEditValues> }
  | { action: "SET_DELIVERY_DATE"; deliveryDate: string }
  | { action: "CORRECT_DELIVERY_DATE"; deliveryDate: string; reason: string };

/**
 * The request for one action. Status moves are `POST /logistics/orders/:id/<route>`; the
 * Manager's two corrections are `PATCH /logistics/orders/:id` (the order's data) and
 * `PATCH /logistics/orders/:id/awb`; Sales' delivery date is
 * `PATCH /logistics/orders/:id/delivery-date`, a `YYYY-MM-DD` day — never null: an order's date
 * can't be cleared (client, 2026-10-17); the Logistics team's correction once QC has verified the
 * order is `PATCH /logistics/orders/:id/delivery-date-correction`, a day and a reason. Required
 * values are sent trimmed; an optional note or courier left blank is left out rather than sent
 * empty.
 */
export function orderActionRequest(
  orderId: string,
  input: OrderActionInput,
): {
  method: "POST" | "PATCH";
  path: string;
  body: Record<string, string | null>;
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
    case "SET_DELIVERY_DATE":
      return {
        method: "PATCH",
        path: `${order}/delivery-date`,
        body: { deliveryDate: input.deliveryDate },
      };
    case "CORRECT_DELIVERY_DATE":
      return {
        method: "PATCH",
        path: `${order}/delivery-date-correction`,
        body: { deliveryDate: input.deliveryDate, reason: input.reason.trim() },
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
