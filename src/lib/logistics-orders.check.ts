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
  COURIER_MAX_LENGTH,
  LOGISTICS_ORDERS_PATH,
  LOGISTICS_STATUSES,
  LOGISTICS_STATUS_LABEL,
  ORDER_ACTIONS,
  ORDER_ACTION_LABEL,
  ORDER_EDIT_FIELDS,
  QC_REMARKS_MAX_LENGTH,
  REASON_MAX_LENGTH,
  dispatchAwbError,
  logisticsOrdersParams,
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
  status: "DISPATCHED",
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
assert.deepEqual(
  LOGISTICS_STATUSES.map((status) => LOGISTICS_STATUS_LABEL[status]),
  [
    "Initial",
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

// The menu follows the backend's readers: both Logistics roles, QC and every sales role (their
// own converted leads only — the API scopes it); Accounts is refused until its own phase.
for (const role of [
  "SUPERADMIN",
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
  "LOGISTICS_MANAGER",
  "LOGISTICS_EXECUTIVE",
  "QC",
] as const) {
  assert.equal(can(role, "useLogistics"), true, `${role} sees Logistics`);
}
assert.equal(can("ACCOUNTS_EXECUTIVE", "useLogistics"), false);
assert.equal(can(undefined, "useLogistics"), false, "no role, no menu");
// The Logistics roles still hold no sales module (ADR-0084).
assert.equal(can("LOGISTICS_MANAGER", "useSalesModules"), false);
assert.equal(can("LOGISTICS_EXECUTIVE", "useSalesModules"), false);
assert.equal(can("QC", "useSalesModules"), false, "QC holds no sales module");

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
    "RESUBMIT",
    "QC_VERIFY",
    "DELIVER",
    "DISPATCH",
  ],
  "every action the backend can offer, in the footer's order: secondary first, forward last",
);
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
  // Components go through the service, never straight to the API client.
  if (file.startsWith("src/components/")) {
    assert.ok(
      !/\bapi(Get|Post|Patch)\b/.test(source),
      `${file} must use the service`,
    );
  }
}
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

console.log("logistics-orders.ts: all checks passed");
