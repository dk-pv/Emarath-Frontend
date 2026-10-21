/**
 * Self-check for the Logistics queue model, its order actions and its menu capability. No
 * test runner is configured, so this is a plain assert script compiled with the repo's own
 * TypeScript (the `format.check.ts` rule), run from the repository root:
 *
 *     npx tsc src/lib/logistics-orders.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/logistics-orders.check.js
 */
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { can } from "../constants/permissions";
import {
  AWB_MAX_LENGTH,
  CITY_MAX_LENGTH,
  COUNTRY_MAX_LENGTH,
  COURIER_MAX_LENGTH,
  DEFAULT_LOGISTICS_SORT,
  LOGISTICS_EXPORT_PATH,
  LOGISTICS_FILTER_OPTIONS_PATH,
  LOGISTICS_ORDERS_PATH,
  LOGISTICS_SCHEDULE_PATH,
  LOGISTICS_SORT_KEYS,
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  LOGISTICS_SUMMARY_PATH,
  MAX_FILTER_VALUES,
  NO_DELIVERY_CHOICE,
  ORDER_ACTIONS,
  ORDER_ACTION_LABEL,
  ORDER_EDIT_FIELDS,
  QC_REMARKS_MAX_LENGTH,
  REASON_MAX_LENGTH,
  dispatchAwbError,
  DELIVERY_BUCKETS,
  DELIVERY_BUCKET_LABEL,
  bucketChoice,
  dayChoice,
  dayIn,
  formatDateOnly,
  isDateOnly,
  isDeliveryChoice,
  scheduleFilters,
  weekdayOf,
  isLogisticsSortKey,
  logisticsFilterParams,
  logisticsOrderHref,
  logisticsOrdersParams,
  logisticsUrlParams,
  readLogisticsFilters,
  shownStatuses,
  orderLockReason,
  ordersLoadError,
  parseLogisticsUrl,
  logisticsStatusLabel,
  orderActionRequest,
  orderEditChanges,
  orderEditErrors,
  orderEditValues,
  orderNumberLabel,
  refetchAfterFailure,
  renderableActions,
  requiredReasonError,
  type OrderAction,
  type OrderActionInput,
} from "./logistics-orders";

// The request: the existing endpoint, the page, and only the filters that narrow it.
assert.equal(LOGISTICS_ORDERS_PATH, "/logistics/orders");
const plain = logisticsOrdersParams({ page: 2, size: 100 });
assert.deepEqual(Object.fromEntries(plain), { page: "2", size: "100" });
const narrowed = logisticsOrdersParams({
  page: 1,
  size: 50,
  status: ["DISPATCHED"],
  search: "  AWB-778 ",
});
assert.deepEqual(Object.fromEntries(narrowed), {
  page: "1",
  size: "50",
  status: "DISPATCHED",
  search: "AWB-778",
});
assert.equal(
  logisticsOrdersParams({ page: 1, size: 50, search: "   " }).has("search"),
  false,
  "a blank search sends nothing",
);
// Several values: each its own repeated key, as the backend reads them; none chosen sends none.
const several = logisticsOrdersParams({
  page: 1,
  size: 50,
  status: ["DISPATCHED", "RTO"],
  country: ["Oman", "United Arab Emirates"],
  city: ["Dubai, Al Barsha", "Ras Al Khaimah"],
});
assert.deepEqual(several.getAll("status"), ["DISPATCHED", "RTO"]);
assert.deepEqual(several.getAll("country"), ["Oman", "United Arab Emirates"]);
assert.deepEqual(several.getAll("city"), [
  "Dubai, Al Barsha",
  "Ras Al Khaimah",
]);
assert.equal(
  logisticsOrdersParams({
    page: 1,
    size: 50,
    status: [],
    country: [],
    city: [],
  }).toString(),
  "page=1&size=50",
);
assert.equal(COUNTRY_MAX_LENGTH, 64, "the backend's country column");
assert.equal(CITY_MAX_LENGTH, 120, "the backend's city column");
assert.equal(MAX_FILTER_VALUES, 100, "the backend's value cap");

// Sorting: only the backend's whitelisted columns, sent with their direction.
assert.deepEqual(
  [...LOGISTICS_SORT_KEYS],
  [
    "orderNumber",
    "customerName",
    "status",
    "convertedAt",
    "statusChangedAt",
    "deliveryDate",
  ],
);
assert.deepEqual(DEFAULT_LOGISTICS_SORT, {
  key: "convertedAt",
  direction: "desc",
});
assert.deepEqual(
  Object.fromEntries(
    logisticsOrdersParams({
      page: 1,
      size: 20,
      status: ["INITIAL"],
      sort: "customerName",
      direction: "asc",
    }),
  ),
  {
    page: "1",
    size: "20",
    status: "INITIAL",
    sort: "customerName",
    direction: "asc",
  },
);
assert.equal(isLogisticsSortKey("orderNumber"), true);
for (const key of ["awbNumber", "id", "convertedAt desc", ""]) {
  assert.equal(isLogisticsSortKey(key), false, `${key} is not sortable`);
}

// The counts: every filter the list sends, its statuses included, never its page or sort.
assert.equal(LOGISTICS_SUMMARY_PATH, "/logistics/orders/summary");
assert.equal(LOGISTICS_EXPORT_PATH, "/logistics/orders/export");
assert.equal(LOGISTICS_FILTER_OPTIONS_PATH, "/logistics/orders/filter-options");
assert.deepEqual(
  Object.fromEntries(logisticsFilterParams({ search: " Acme " })),
  {
    search: "Acme",
  },
);
assert.equal(logisticsFilterParams({ search: "   " }).toString(), "");
assert.equal(logisticsFilterParams({}).toString(), "");
const filterSet = {
  status: ["QC_VERIFIED", "DISPATCHED"],
  delivery: ["tomorrow", "overdue"],
  country: ["Oman"],
  city: ["Muscat", "Sohar"],
  state: ["Dubai"],
  courier: ["Aramex", "DHL"],
  assignedAgent: ["22222222-2222-4222-8222-222222222222"],
  search: "Acme",
} as const;
const countsParams = logisticsFilterParams(filterSet);
const listParams = logisticsOrdersParams({
  ...filterSet,
  page: 3,
  size: 20,
  sort: "orderNumber",
  direction: "asc",
});
for (const key of ["page", "size", "sort", "direction"]) {
  listParams.delete(key);
}
assert.equal(
  countsParams.toString(),
  listParams.toString(),
  "the counts send exactly the list's filters",
);
// The inverse: the request string keys the filters, and reads back as the same filters.
assert.deepEqual(readLogisticsFilters(countsParams), {
  status: ["QC_VERIFIED", "DISPATCHED"],
  delivery: ["tomorrow", "overdue"],
  deliveryOn: undefined,
  country: ["Oman"],
  city: ["Muscat", "Sohar"],
  state: ["Dubai"],
  courier: ["Aramex", "DHL"],
  assignedAgent: ["22222222-2222-4222-8222-222222222222"],
  search: "Acme",
});
// The new filters go out under the backend DTO's own parameter names.
assert.deepEqual(countsParams.getAll("courier"), ["Aramex", "DHL"]);
assert.deepEqual(countsParams.getAll("state"), ["Dubai"]);
assert.deepEqual(countsParams.getAll("assignedAgent"), [
  "22222222-2222-4222-8222-222222222222",
]);
assert.deepEqual(countsParams.getAll("delivery"), ["tomorrow", "overdue"]);
assert.deepEqual(readLogisticsFilters(new URLSearchParams()), {
  status: [],
  delivery: [],
  deliveryOn: undefined,
  country: [],
  city: [],
  state: [],
  courier: [],
  assignedAgent: [],
  search: undefined,
});
// The statuses a view shows: the chosen ones in lifecycle order, or all of them.
assert.deepEqual(shownStatuses([]), LOGISTICS_STATUSES);
assert.deepEqual(shownStatuses(["RTO", "INITIAL"]), ["RTO", "INITIAL"]);

// The address: a plain visit is the default screen; anything malformed falls back to a default
// instead of reaching the API as a request it would refuse.
const LIMITS = {
  pageSizes: [10, 25, 50, 100],
  defaultSize: 100,
  searchMax: 200,
};
const url = (query: string) =>
  parseLogisticsUrl(new URLSearchParams(query), LIMITS);
assert.deepEqual(url(""), {
  view: "list",
  status: [],
  delivery: [],
  deliveryOn: null,
  country: [],
  city: [],
  state: [],
  courier: [],
  assignedAgent: [],
  q: "",
  page: 1,
  size: 100,
  sort: "convertedAt",
  direction: "desc",
  order: null,
});
assert.deepEqual(
  url(
    `view=pipeline&status=DISPATCHED&q=+Acme+&page=3&size=25&sort=status&direction=asc&order=${"33333333-3333-4333-8333-333333333333"}`,
  ),
  {
    view: "pipeline",
    status: ["DISPATCHED"],
    delivery: [],
    deliveryOn: null,
    country: [],
    city: [],
    state: [],
    courier: [],
    assignedAgent: [],
    q: "Acme",
    page: 3,
    size: 25,
    sort: "status",
    direction: "asc",
    order: "33333333-3333-4333-8333-333333333333",
  },
  "a Phase 1 link, with one status, still opens as it did",
);
assert.deepEqual(
  url(
    "view=board&status=SHIPPED&page=-2&size=7&sort=awbNumber&direction=up&order=1;drop&country=+&city=&state=&courier=+&assignedAgent=not-a-uuid",
  ),
  url(""),
  "every malformed value falls back to its default",
);
// Several statuses read in lifecycle order whatever the address's order, each once; an unknown
// one is dropped, the rest kept.
assert.deepEqual(
  url("status=RTO&status=bogus&status=INITIAL&status=RTO").status,
  ["INITIAL", "RTO"],
);
// Countries and cities: trimmed, each once, blanks dropped, and a value longer than its column
// (which could match no order, and the API would refuse) dropped rather than cut.
assert.deepEqual(
  url(
    `country=+Oman+&country=Oman&country=&country=${"x".repeat(65)}&country=${"y".repeat(64)}`,
  ).country,
  ["Oman", "y".repeat(64)],
);
assert.deepEqual(url(`city=${"c".repeat(121)}&city=${"d".repeat(120)}`).city, [
  "d".repeat(120),
]);
assert.equal(
  url(Array.from({ length: 150 }, (_, i) => `city=c${i}`).join("&")).city
    .length,
  100,
  "at most the API's value count",
);
// States, delivery partners and sales executives follow the same rules, at their own columns'
// lengths; a sales executive that is not a user id is dropped.
assert.deepEqual(
  url(`state=+Dubai+&state=Dubai&state=${"s".repeat(121)}`).state,
  ["Dubai"],
);
assert.deepEqual(url(`courier=${"k".repeat(65)}&courier=Aramex`).courier, [
  "Aramex",
]);
assert.deepEqual(
  url(
    "assignedAgent=22222222-2222-4222-8222-222222222222&assignedAgent=1;drop&assignedAgent=22222222-2222-4222-8222-222222222222",
  ).assignedAgent,
  ["22222222-2222-4222-8222-222222222222"],
);
assert.equal(url("page=2.5").page, 1);
assert.equal(url("page=99999999999999999999").page, 1);
assert.equal(
  url(`q=${"a".repeat(250)}`).q.length,
  200,
  "q stops at the box's limit",
);
// Written back: only what differs from the defaults, and it reads back as the same state.
assert.equal(logisticsUrlParams(url(""), 100).toString(), "");
const shared = url(
  "view=pipeline&status=RTO&q=AWB-1&page=2&size=50&sort=orderNumber&direction=desc&order=33333333-3333-4333-8333-333333333333",
);
assert.deepEqual(
  url(logisticsUrlParams(shared, 100).toString()),
  shared,
  "the address round-trips",
);
const filtered = url(
  logisticsUrlParams(
    {
      ...url(""),
      view: "pipeline",
      status: ["QC_VERIFIED", "DISPATCHED"],
      country: ["United Arab Emirates", "Oman"],
      city: ["Dubai, Al Barsha", "Abu Dhabi & Al Ain", "دبي", "50% off_"],
      state: ["Ras Al Khaimah", "Umm Al Quwain"],
      courier: ["Fetchr & Co", "DHL"],
      assignedAgent: ["22222222-2222-4222-8222-222222222222"],
    },
    100,
  ).toString(),
);
assert.deepEqual(
  [
    filtered.status,
    filtered.country,
    filtered.city,
    filtered.state,
    filtered.courier,
    filtered.assignedAgent,
  ],
  [
    ["QC_VERIFIED", "DISPATCHED"],
    ["United Arab Emirates", "Oman"],
    ["Dubai, Al Barsha", "Abu Dhabi & Al Ain", "دبي", "50% off_"],
    ["Ras Al Khaimah", "Umm Al Quwain"],
    ["Fetchr & Co", "DHL"],
    ["22222222-2222-4222-8222-222222222222"],
  ],
  "filters with commas, ampersands, other scripts and % round-trip exactly",
);
assert.deepEqual(
  Object.fromEntries(logisticsUrlParams({ ...url(""), direction: "asc" }, 100)),
  { sort: "convertedAt", direction: "asc" },
  "a changed direction keeps its column",
);

// What the screen says when orders can't be loaded: a refusal is not a dropped connection.
assert.match(ordersLoadError(403), /access/);
assert.match(ordersLoadError(400), /filters/);
for (const status of [500, 0, undefined]) {
  assert.match(ordersLoadError(status), /connection/);
}

// The Lead Detail page's link to an order opens that order's panel on the Logistics screen.
assert.equal(
  logisticsOrderHref("33333333-3333-4333-8333-333333333333"),
  "/logistics?order=33333333-3333-4333-8333-333333333333",
);

// The vocabulary: the backend's seven statuses in lifecycle order, each with a label.
assert.deepEqual(
  [...LOGISTICS_STATUSES],
  [
    "INITIAL",
    "QC_VERIFIED",
    "QC_REJECTED",
    "DISPATCHED",
    "DELIVERED",
    "CANCELLED",
    "RTO",
  ],
);
// INITIAL reads "QC Pending" everywhere the screen shows a status; the value itself stays INITIAL
// in every request, so the API contract is unchanged.
assert.equal(logisticsStatusLabel("INITIAL"), "QC Pending");
assert.equal(
  logisticsOrdersParams({ page: 1, size: 20, status: ["INITIAL"] }).get(
    "status",
  ),
  "INITIAL",
);
assert.deepEqual(
  LOGISTICS_STATUSES.map((status) => LOGISTICS_STATUS_LABEL[status]),
  [
    "QC Pending",
    "QC Verified",
    "QC Rejected",
    "Dispatched",
    "Delivered",
    "Cancelled",
    "RTO",
  ],
);
assert.equal(
  logisticsStatusLabel("ON_HOLD"),
  "ON_HOLD",
  "a status this build does not know still shows, never blank",
);
assert.equal(orderNumberLabel(1001), "#1001");

// The menu follows the backend's readers: both Logistics roles, QC, every sales role (their
// own converted leads only — the API scopes it) and Accounts (the Delivered orders only, with no
// action — the API scopes and refuses that too).
for (const role of [
  "SUPERADMIN",
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
  "LOGISTICS_MANAGER",
  "LOGISTICS_EXECUTIVE",
  "QC",
  "ACCOUNTS_EXECUTIVE",
] as const) {
  assert.equal(can(role, "useLogistics"), true, `${role} sees Logistics`);
}
// Accounts holds no sales module; it reads its Delivered orders here beside its own records.
assert.equal(can("ACCOUNTS_EXECUTIVE", "useSalesModules"), false);
// No action is offered unless the backend lists it — Accounts' list is empty.
assert.deepEqual(renderableActions([]), []);
assert.equal(can(undefined, "useLogistics"), false, "no role, no menu");
// The Logistics roles still hold no sales module (ADR-0084).
assert.equal(can("LOGISTICS_MANAGER", "useSalesModules"), false);
assert.equal(can("LOGISTICS_EXECUTIVE", "useSalesModules"), false);
assert.equal(can("QC", "useSalesModules"), false, "QC holds no sales module");

// The delivery-partner export (3PL-01) is offered to the roles that dispatch: the backend's
// EXPORT_ROLES, which refuses everyone else with a 403.
for (const [role, may] of [
  ["SUPERADMIN", true],
  ["LOGISTICS_MANAGER", true],
  ["LOGISTICS_EXECUTIVE", true],
  ["QC", false],
  ["ACCOUNTS_EXECUTIVE", false],
  ["SALES_MANAGER", false],
  ["SALES_AGENT", false],
  ["CUSTOMER_SERVICE_AGENT", false],
  ["MARKETING_ANALYST", false],
] as const) {
  assert.equal(can(role, "exportLogistics"), may, `${role} export`);
}
assert.equal(can(undefined, "exportLogistics"), false, "no role, no export");

// ---------------------------------------------------------------------------------------------
// Actions. The backend decides which apply (`allowedActions`); the screen renders every action it
// implements, in a fixed order, and ignores anything else it is sent.
const ORDER = "33333333-3333-4333-8333-333333333333";
assert.deepEqual(
  [...ORDER_ACTIONS],
  [
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
  ],
  "every action the backend can offer, in the footer's order: secondary first, forward last",
);
// The Logistics team's correction of the date once QC has verified the order (client, 2026-10-17):
// shown only when the backend offers it, before the forward step, with its own request.
assert.equal(ORDER_ACTION_LABEL.CORRECT_DELIVERY_DATE, "Correct delivery date");
assert.deepEqual(renderableActions(["DISPATCH", "CORRECT_DELIVERY_DATE"]), [
  "CORRECT_DELIVERY_DATE",
  "DISPATCH",
]);
assert.deepEqual(
  orderActionRequest(ORDER, {
    action: "CORRECT_DELIVERY_DATE",
    deliveryDate: "2026-10-22",
    reason: "  Customer moved the day  ",
  }),
  {
    method: "PATCH",
    path: `/logistics/orders/${ORDER}/delivery-date-correction`,
    body: { deliveryDate: "2026-10-22", reason: "Customer moved the day" },
  },
  "a day and a trimmed reason, never null",
);
// A Sales Manager on a QC-rejected order: the date, then the forward step.
assert.deepEqual(renderableActions(["RESUBMIT", "SET_DELIVERY_DATE"]), [
  "SET_DELIVERY_DATE",
  "RESUBMIT",
]);
assert.equal(ORDER_ACTION_LABEL.SET_DELIVERY_DATE, "Set delivery date");
assert.deepEqual(renderableActions([]), [], "no allowed actions, no controls");
assert.deepEqual(
  renderableActions(["DELIVER", "CANCEL", "RTO", "CORRECT_AWB"]),
  ["CANCEL", "RTO", "CORRECT_AWB", "DELIVER"],
  "shown in the screen's order whatever the list's order",
);
for (const action of ORDER_ACTIONS) {
  assert.deepEqual(renderableActions([action]), [action], `${action} alone`);
  assert.ok(
    !renderableActions(ORDER_ACTIONS.filter((a) => a !== action)).includes(
      action,
    ),
    `${action} is never shown unless the backend offers it`,
  );
  assert.ok(ORDER_ACTION_LABEL[action], `${action} has a label`);
}
assert.deepEqual(
  renderableActions(["SOMETHING_NEW"]),
  [],
  "an action this build does not know is left alone",
);

// Each request is its backend route and DTO as they stand — kebab-case routes, never the
// action's own name.
const at = (route: string) => `/logistics/orders/${ORDER}${route}`;
assert.deepEqual(
  orderActionRequest(ORDER, { action: "QC_VERIFY", remarks: "  " }),
  { method: "POST", path: at("/qc-verify"), body: {} },
  "approval remarks are optional, left out when blank",
);
assert.deepEqual(
  orderActionRequest(ORDER, { action: "QC_VERIFY", remarks: " OK " }).body,
  { remarks: "OK" },
);
assert.deepEqual(
  orderActionRequest(ORDER, {
    action: "QC_REJECT",
    remarks: " Wrong address ",
  }),
  {
    method: "POST",
    path: at("/qc-reject"),
    body: { remarks: "Wrong address" },
  },
);
assert.deepEqual(
  orderActionRequest(ORDER, { action: "RESUBMIT", remarks: "" }),
  { method: "POST", path: at("/resubmit"), body: {} },
);
assert.deepEqual(
  orderActionRequest(ORDER, {
    action: "DISPATCH",
    awbNumber: "  AWB-1 ",
    courier: " ",
  }),
  { method: "POST", path: at("/dispatch"), body: { awbNumber: "AWB-1" } },
);
assert.deepEqual(
  orderActionRequest(ORDER, {
    action: "DISPATCH",
    awbNumber: "AWB-1",
    courier: " Aramex ",
  }).body,
  { awbNumber: "AWB-1", courier: "Aramex" },
);
assert.deepEqual(orderActionRequest(ORDER, { action: "DELIVER" }), {
  method: "POST",
  path: at("/deliver"),
  body: {},
});
for (const action of ["CANCEL", "RTO"] as const) {
  assert.deepEqual(
    orderActionRequest(ORDER, { action, reason: " Refused " }),
    {
      method: "POST",
      path: at(`/${action.toLowerCase()}`),
      body: { reason: "Refused" },
    },
    `${action} always sends its mandatory reason`,
  );
}
assert.deepEqual(
  orderActionRequest(ORDER, { action: "CORRECT_AWB", awbNumber: " AWB-2 " }),
  { method: "PATCH", path: at("/awb"), body: { awbNumber: "AWB-2" } },
);
assert.deepEqual(
  orderActionRequest(ORDER, { action: "EDIT", changes: { city: "Abu Dhabi" } }),
  { method: "PATCH", path: at(""), body: { city: "Abu Dhabi" } },
);
// Sales' delivery date (Phase 2D): a calendar day — never null or "": it can't be cleared.
assert.deepEqual(
  orderActionRequest(ORDER, {
    action: "SET_DELIVERY_DATE",
    deliveryDate: "2026-10-20",
  }),
  {
    method: "PATCH",
    path: at("/delivery-date"),
    body: { deliveryDate: "2026-10-20" },
  },
);
// The backend DTOs' limits, which the forms enforce.
assert.equal(AWB_MAX_LENGTH, 64);
assert.equal(COURIER_MAX_LENGTH, 64);
assert.equal(REASON_MAX_LENGTH, 500);
assert.equal(QC_REMARKS_MAX_LENGTH, 2000);

// The rules the forms check themselves — the backend's: no blank AWB, no blank mandatory reason.
assert.ok(dispatchAwbError(""));
assert.ok(dispatchAwbError("   "));
assert.equal(dispatchAwbError("AWB-1"), undefined);
assert.ok(requiredReasonError(""));
assert.ok(requiredReasonError("  "));
assert.equal(requiredReasonError("Customer refused"), undefined);

// The Manager's edit: the backend's fields, only what changed is sent, a field emptied is sent
// blank (a clear), name and phone cannot be blanked, numbers must be numbers.
assert.deepEqual(
  ORDER_EDIT_FIELDS.map((field) => field.key),
  [
    "customerName",
    "primaryPhone",
    "secondaryPhone",
    "email",
    "street",
    "city",
    "state",
    "country",
    "nationalCode",
    "product",
    "productQty",
    "product2",
    "product2Qty",
    "orderValue",
    "paymentMethod",
    "deliveryDate",
  ],
);
const initial = orderEditValues({
  customerName: "Acme",
  primaryPhone: "971500000000",
  secondaryPhone: null,
  email: null,
  street: "Old Rd",
  city: "Dubai",
  state: null,
  country: null,
  nationalCode: null,
  product: "Filter",
  productQty: "2",
  product2: null,
  product2Qty: null,
  orderValue: "250",
  paymentMethod: null,
  deliveryDate: null,
});
assert.equal(initial.secondaryPhone, "", "a missing value starts blank");
assert.deepEqual(
  orderEditChanges(initial, { ...initial }),
  {},
  "nothing changed",
);
assert.deepEqual(
  orderEditChanges(initial, { ...initial, city: " Abu Dhabi ", street: "" }),
  { city: "Abu Dhabi", street: "" },
);
assert.deepEqual(orderEditErrors(initial), {});
assert.deepEqual(
  Object.keys(
    orderEditErrors({
      ...initial,
      customerName: " ",
      primaryPhone: "",
      orderValue: "lots",
      productQty: "1.5",
    }),
  ),
  ["customerName", "primaryPhone", "orderValue"],
);
// The backend's Decimal(12, 2) rule: ten integer digits, two decimals.
for (const [value, ok] of [
  ["250.55", true],
  ["1234567890.99", true],
  ["250.555", false],
  ["12345678901", false],
  ["1e5", false],
] as const) {
  assert.equal(
    "orderValue" in orderEditErrors({ ...initial, orderValue: value }),
    !ok,
    `Order Value ${value} is ${ok ? "accepted" : "refused"}`,
  );
}

// A refusal that says the order or the caller's rights moved on reads the order again; nothing
// else does, and nothing is retried.
for (const status of [403, 404, 409]) {
  assert.equal(refetchAfterFailure(status), true, `${status} reloads`);
}
for (const status of [400, 401, 500, undefined]) {
  assert.equal(refetchAfterFailure(status), false, `${status} does not`);
}

// ---------------------------------------------------------------------------------------------
// Delivery dates (ADR-0094). The buckets are the backend's, worked out in the business timezone;
// the screen only names them, files them in the address and shows each order's.
assert.deepEqual(
  [...DELIVERY_BUCKETS],
  ["today", "tomorrow", "future", "overdue", "none"],
);
assert.deepEqual(
  DELIVERY_BUCKETS.map((bucket) => DELIVERY_BUCKET_LABEL[bucket]),
  ["Today", "Tomorrow", "Future-Dated", "Overdue", "No Delivery Date"],
);
// In the address: repeated keys, read back in the buckets' own order, unknown ones dropped.
assert.deepEqual(
  url("delivery=none&delivery=someday&delivery=today&delivery=none").delivery,
  ["today", "none"],
);
const dated = url(
  logisticsUrlParams(
    { ...url(""), delivery: ["overdue", "future"], status: ["DISPATCHED"] },
    100,
  ).toString(),
);
assert.deepEqual(
  [dated.delivery, dated.status],
  [["future", "overdue"], ["DISPATCHED"]],
  "the delivery filter round-trips beside the others",
);
assert.deepEqual(
  logisticsOrdersParams({ page: 1, size: 20, delivery: ["tomorrow"] }).getAll(
    "delivery",
  ),
  ["tomorrow"],
);
// A date-only value is checked and shown as text — never through a local-time Date, so no
// timezone can move it a day.
for (const value of ["2026-10-15", "2028-02-29", "2000-01-01", "2099-12-31"]) {
  assert.equal(isDateOnly(value), true, `${value} is a day`);
}
for (const value of [
  "2026-02-30",
  "2027-02-29",
  "2026-2-3",
  "15-10-2026",
  "2026-10-15T00:00:00.000Z",
  "1999-12-31",
  "2100-01-01",
  "",
]) {
  assert.equal(isDateOnly(value), false, `${value} is not a day`);
}
assert.equal(formatDateOnly("2026-10-15"), "15-10-2026");
assert.equal(formatDateOnly("2026-01-01"), "01-01-2026");
assert.equal(formatDateOnly("not a date"), "not a date");
// The Manager's edit carries the date: it is sent when it changes, a non-day is refused before
// sending, and the form offers no way to clear it (asserted on the source below).
assert.equal(initial.deliveryDate, "", "an undated order's date starts blank");
assert.deepEqual(
  orderEditChanges(initial, { ...initial, deliveryDate: "2026-10-20" }),
  { deliveryDate: "2026-10-20" },
);
assert.deepEqual(
  orderEditChanges(
    { ...initial, deliveryDate: "2026-10-20" },
    { ...initial, deliveryDate: "2026-10-22" },
  ),
  { deliveryDate: "2026-10-22" },
  "a changed date is sent",
);
assert.ok(
  "deliveryDate" in orderEditErrors({ ...initial, deliveryDate: "2026-02-30" }),
);
assert.deepEqual(
  orderEditErrors({ ...initial, deliveryDate: "2026-10-20" }),
  {},
);

// ---------------------------------------------------------------------------------------------
// The delivery schedule (Phase 2C). A chosen day is one more Delivery Date value: in the address
// and in every request beside the buckets, and dropped when it is not a real day.
assert.equal(url("deliveryOn=2026-10-20").deliveryOn, "2026-10-20");
for (const bad of ["2026-02-30", "20-10-2026", "2026-10-20T00:00:00Z", ""]) {
  assert.equal(url(`deliveryOn=${bad}`).deliveryOn, null, `${bad} is dropped`);
}
assert.equal(
  url(
    logisticsUrlParams(
      { ...url(""), deliveryOn: "2026-10-20", page: 3 },
      100,
    ).toString(),
  ).deliveryOn,
  "2026-10-20",
  "the chosen day round-trips through the address",
);
assert.equal(
  logisticsFilterParams({
    delivery: ["overdue"],
    deliveryOn: "2026-10-20",
  }).toString(),
  "delivery=overdue&deliveryOn=2026-10-20",
);
assert.equal(
  readLogisticsFilters(new URLSearchParams("deliveryOn=2026-10-20")).deliveryOn,
  "2026-10-20",
);
assert.equal(
  readLogisticsFilters(new URLSearchParams("deliveryOn=2026-02-30")).deliveryOn,
  undefined,
);
// The schedule is read with every filter but the delivery date's own, so choosing a bucket or a
// day never reads it again.
assert.equal(LOGISTICS_SCHEDULE_PATH, "/logistics/orders/delivery-schedule");
assert.equal(
  logisticsFilterParams(
    scheduleFilters({ ...filterSet, deliveryOn: "2026-10-20" }),
  ).toString(),
  logisticsFilterParams({ ...filterSet, delivery: [] }).toString(),
);
// Choosing on the schedule: a bucket alone; Today and Tomorrow as their buckets, so the choice
// moves on with the business day; any other day as itself.
const DAY = {
  timeZone: "Asia/Dubai",
  today: "2026-10-15",
  tomorrow: "2026-10-16",
};
assert.deepEqual(bucketChoice("overdue"), {
  delivery: ["overdue"],
  deliveryOn: null,
});
assert.deepEqual(dayChoice("2026-10-15", DAY), bucketChoice("today"));
assert.deepEqual(dayChoice("2026-10-16", DAY), bucketChoice("tomorrow"));
assert.deepEqual(dayChoice("2026-10-20", DAY), {
  delivery: [],
  deliveryOn: "2026-10-20",
});
// Shown as chosen only when the filter holds exactly that choice.
assert.ok(
  isDeliveryChoice(
    { delivery: ["tomorrow"], deliveryOn: null },
    dayChoice("2026-10-16", DAY),
  ),
);
assert.ok(
  !isDeliveryChoice(
    { delivery: ["tomorrow", "today"], deliveryOn: null },
    bucketChoice("tomorrow"),
  ),
  "two buckets are not one",
);
assert.ok(
  !isDeliveryChoice(
    { delivery: ["tomorrow"], deliveryOn: "2026-10-20" },
    bucketChoice("tomorrow"),
  ),
  "a bucket beside a day is not the bucket alone",
);
assert.ok(
  !isDeliveryChoice(
    { delivery: [], deliveryOn: "2026-10-21" },
    dayChoice("2026-10-20", DAY),
  ),
);
assert.ok(
  isDeliveryChoice(NO_DELIVERY_CHOICE, { delivery: [], deliveryOn: null }),
);
// Weekdays from the calendar alone; the business day read in its own zone, never this browser's.
assert.deepEqual(
  ["2026-10-15", "2026-10-18", "2028-02-29", "15-10-2026"].map(weekdayOf),
  ["Thu", "Sun", "Tue", ""],
);
const lateEvening = new Date("2026-10-14T20:30:00.000Z");
assert.deepEqual(
  ["Asia/Dubai", "Asia/Muscat", "Asia/Riyadh"].map((zone) =>
    dayIn(zone, lateEvening),
  ),
  ["2026-10-15", "2026-10-15", "2026-10-14"],
);
// The schedule keeps the chosen day as its YYYY-MM-DD parts (dateKey/keyBound), never an instant,
// and sits once in the slot both views share.
const scheduleView = readFileSync(
  "src/components/logistics/logistics-delivery-schedule.tsx",
  "utf8",
);
assert.ok(
  scheduleView.includes("dateKey(") &&
    scheduleView.includes("keyBound(") &&
    !/new Date\(|toISOString\(/.test(scheduleView),
  "the schedule's date picker keeps a calendar day, never an instant",
);
const view = readFileSync(
  "src/components/logistics/logistics-view.tsx",
  "utf8",
);
assert.equal(view.split("<LogisticsDeliverySchedule").length - 1, 1);

// Source-level guarantees, across everything the Logistics screen ships.
const files = [
  "src/lib/logistics-orders.ts",
  "src/services/logistics-service.ts",
  ...readdirSync("src/components/logistics").map(
    (name) => `src/components/logistics/${name}`,
  ),
];
for (const file of files) {
  const source = readFileSync(file, "utf8");
  // Reads, the POST moves and the two PATCH corrections: no PUT, DELETE or upload anywhere.
  for (const writer of ["apiPut", "apiDelete", "apiPostForm"]) {
    assert.ok(!source.includes(writer), `${file} must not use ${writer}`);
  }
  // Components go through the service, never straight to the API client — and name a status
  // only through its label, so "QC Pending" can't drift back to "Initial" on one surface.
  if (file.startsWith("src/components/")) {
    assert.ok(
      !/\bapi(Get|Post|Patch)\b/.test(source),
      `${file} must use the service`,
    );
    assert.ok(
      !/["'>`]Initial\b/.test(source),
      `${file} must label statuses through LOGISTICS_STATUS_LABEL`,
    );
  }
}
// The Pipeline view changes no status itself: no drag-and-drop, and every move goes through the
// order panel's actions. It reads orders through the list's own service call, never a copy.
const board = readFileSync(
  "src/components/logistics/logistics-board.tsx",
  "utf8",
);
for (const drag of ["draggable", "onDrag", "onDrop", "runOrderAction"]) {
  assert.ok(!board.includes(drag), `the board must not use ${drag}`);
}
// No Logistics component turns a delivery date into an instant or works its bucket out itself:
// the date is shown as text and the bucket is the backend's.
for (const file of files.filter((name) => name.startsWith("src/components/"))) {
  const source = readFileSync(file, "utf8");
  assert.ok(
    !/(new Date|formatDate|formatDateTime)\(\s*[\w.]*deliveryDate/.test(source),
    `${file} must not read a delivery date as an instant`,
  );
}
// The one component that shows a delivery date formats it as text and never builds a Date.
const deliveryDateView = readFileSync(
  "src/components/logistics/logistics-delivery-date.tsx",
  "utf8",
);
assert.ok(
  deliveryDateView.includes("formatDateOnly(") &&
    !/\bformatDate(Time)?\(|new Date\(/.test(deliveryDateView),
  "the delivery date is shown with formatDateOnly, never through a Date",
);
assert.ok(board.includes("fetchLogisticsOrders("), "the board reads the list");
// Each column sends the screen's filters with its own status in place of the Status filter —
// after the filters, so the column's status is the one that is sent.
const columnReads = board.match(/fetchLogisticsOrders\(\s*\{[^}]*\}/g) ?? [];
assert.equal(columnReads.length, 2, "first page and Load more");
for (const read of columnReads) {
  assert.match(read, /\.\.\.filters,[^}]*status: \[status\]/);
}
// The filters are the shared filter control, not a Logistics copy of it.
const filterPanel = readFileSync(
  "src/components/logistics/logistics-filter-panel.tsx",
  "utf8",
);
assert.ok(
  filterPanel.includes('from "@/components/filters/filter-panel"'),
  "the Filter control is the shared FilterPanel",
);

// The action routes are kebab-case; a route built from the action's name would be refused.
const lib = readFileSync("src/lib/logistics-orders.ts", "utf8");
assert.ok(
  !/action\.toLowerCase\(\)/.test(lib),
  "no route built from an action name",
);

// Compile-time: the request shapes and the action list name exactly the same actions, so an
// action added to one without the other fails the typecheck rather than drifting silently.
type Same<A, B> = [A] extends [B] ? ([B] extends [A] ? true : false) : false;
const inputsMatchActions: Same<OrderAction, OrderActionInput["action"]> = true;
assert.equal(inputsMatchActions, true);

// Every action the panel can render opens its own dialog: the open === "<ACTION>" chain in the
// actions component is not exhaustive by construction, so it is checked here.
const panel = readFileSync(
  "src/components/logistics/logistics-order-actions.tsx",
  "utf8",
);
for (const action of ORDER_ACTIONS) {
  assert.ok(
    panel.includes(`open === "${action}"`),
    `the actions panel has a dialog for ${action}`,
  );
}
// Every order must have a delivery date (client, 2026-10-17): neither date dialog offers a Clear,
// the Sales dialog never sends null, and it saves only a day that differs from the order's.
const editForm = readFileSync(
  "src/components/logistics/logistics-order-edit.tsx",
  "utf8",
);
assert.ok(
  !panel.includes("Clear the delivery date") && !/>\s*Clear\s*</.test(panel),
  "the Sales date dialog has no Clear",
);
assert.ok(!/>\s*Clear\s*</.test(editForm), "the Manager's edit has no Clear");
assert.ok(
  !panel.includes("deliveryDate || null") &&
    panel.includes("!deliveryDate || deliveryDate === order.deliveryDate"),
  "the Sales dialog sends a day, and only a new one",
);

// A lead with an order has its Delete, Convert, status and pipeline controls off, and says why
// with the order's own number; a lead without one — a legacy WON lead included — keeps them.
assert.equal(
  orderLockReason({
    id: "order-42",
    orderNumber: 42,
    status: "QC_REJECTED",
    deliveryDate: null,
  }),
  "Logistics order #42 manages this lead’s status and pipeline, and the lead can’t be deleted.",
);
assert.equal(orderLockReason(null), null);

// The lead screens' order link shows the order's delivery date, or "No Delivery Date" (Phase 2D),
// as text rearranged from its parts, so no timezone can move it.
const orderLink = readFileSync(
  "src/components/logistics/logistics-order-link.tsx",
  "utf8",
);
assert.ok(
  orderLink.includes("formatDateOnly(order.deliveryDate)") &&
    orderLink.includes("DELIVERY_BUCKET_LABEL.none"),
  "the order link shows the delivery date or No Delivery Date",
);
assert.equal(orderLockReason(undefined), null);

console.log("logistics-orders.ts: all checks passed");
