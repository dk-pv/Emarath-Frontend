/**
 * Self-check for the Logistics queue model, its shipment actions and its menu capability. No
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
  REASON_MAX_LENGTH,
  SHIPMENT_ACTIONS,
  SHIPMENT_ACTION_LABEL,
  dispatchAwbError,
  logisticsOrdersParams,
  logisticsStatusLabel,
  orderNumberLabel,
  refetchAfterFailure,
  renderableActions,
  shipmentActionRequest,
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

// The menu follows the backend's readers: both Logistics roles and every sales role (their
// own converted leads only — the API scopes it); Accounts is refused until its own phase.
for (const role of [
  "SUPERADMIN",
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
  "LOGISTICS_MANAGER",
  "LOGISTICS_EXECUTIVE",
] as const) {
  assert.equal(can(role, "useLogistics"), true, `${role} sees Logistics`);
}
assert.equal(can("ACCOUNTS_EXECUTIVE", "useLogistics"), false);
assert.equal(can(undefined, "useLogistics"), false, "no role, no menu");
// The Logistics roles still hold no sales module (ADR-0084).
assert.equal(can("LOGISTICS_MANAGER", "useSalesModules"), false);
assert.equal(can("LOGISTICS_EXECUTIVE", "useSalesModules"), false);

// ---------------------------------------------------------------------------------------------
// Actions. The backend decides which apply (`allowedActions`); the screen renders only the
// shipment steps it implements, in a fixed order, and ignores anything else it is sent.
const ORDER = "33333333-3333-4333-8333-333333333333";
assert.deepEqual(
  [...SHIPMENT_ACTIONS],
  ["DISPATCH", "DELIVER", "CANCEL", "RTO"],
);
assert.deepEqual(renderableActions([]), [], "no allowed actions, no controls");
assert.deepEqual(
  renderableActions(["DELIVER", "CANCEL", "RTO"]),
  ["DELIVER", "CANCEL", "RTO"],
  "a dispatched order, as the backend offers it",
);
assert.deepEqual(
  renderableActions(["RTO", "CANCEL", "DELIVER"]),
  ["DELIVER", "CANCEL", "RTO"],
  "shown in the screen's order whatever the list's order",
);
for (const action of SHIPMENT_ACTIONS) {
  assert.deepEqual(renderableActions([action]), [action], `${action} alone`);
  assert.ok(
    !renderableActions(SHIPMENT_ACTIONS.filter((a) => a !== action)).includes(
      action,
    ),
    `${action} is never shown unless the backend offers it`,
  );
  assert.ok(SHIPMENT_ACTION_LABEL[action], `${action} has a label`);
}
// The withheld QC and resubmit steps — and anything a later backend adds — never become
// controls here, even if a backend were to list them.
assert.deepEqual(
  renderableActions(["QC_VERIFY", "QC_REJECT", "RESUBMIT", "SOMETHING_NEW"]),
  [],
);

// Each request is its backend DTO as it stands: the AWB required at dispatch, the courier and
// the reasons optional (left out when blank, never sent empty), nothing for delivery.
assert.deepEqual(
  shipmentActionRequest(ORDER, {
    action: "DISPATCH",
    awbNumber: "  AWB-1 ",
    courier: " ",
  }),
  { path: `/logistics/orders/${ORDER}/dispatch`, body: { awbNumber: "AWB-1" } },
);
assert.deepEqual(
  shipmentActionRequest(ORDER, {
    action: "DISPATCH",
    awbNumber: "AWB-1",
    courier: " Aramex ",
  }).body,
  { awbNumber: "AWB-1", courier: "Aramex" },
);
assert.deepEqual(shipmentActionRequest(ORDER, { action: "DELIVER" }), {
  path: `/logistics/orders/${ORDER}/deliver`,
  body: {},
});
for (const action of ["CANCEL", "RTO"] as const) {
  const path = `/logistics/orders/${ORDER}/${action.toLowerCase()}`;
  assert.deepEqual(shipmentActionRequest(ORDER, { action, reason: "  " }), {
    path,
    body: {},
  });
  assert.deepEqual(
    shipmentActionRequest(ORDER, { action, reason: " Refused " }).body,
    { reason: "Refused" },
  );
}
// The backend DTOs' limits, which the form enforces.
assert.equal(AWB_MAX_LENGTH, 64);
assert.equal(COURIER_MAX_LENGTH, 64);
assert.equal(REASON_MAX_LENGTH, 500);

// The one rule the form checks itself — the backend's: no dispatch without an AWB.
assert.ok(dispatchAwbError(""));
assert.ok(dispatchAwbError("   "));
assert.equal(dispatchAwbError("AWB-1"), undefined);

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
  // QC and resubmit are withheld until the client answers: no control, no call, no route.
  // Word-bounded, because the statuses QC_VERIFIED and QC_REJECTED legitimately exist.
  for (const withheld of [
    /\bQC_VERIFY\b/,
    /\bQC_REJECT\b/,
    /\bRESUBMIT\b/,
    /\/(qc-verify|qc-reject|resubmit)\b/,
  ]) {
    assert.ok(!withheld.test(source), `${file} must not mention ${withheld}`);
  }
  // Only reads and the four shipment POSTs: no PUT, PATCH, DELETE or upload anywhere.
  for (const writer of ["apiPut", "apiPatch", "apiDelete", "apiPostForm"]) {
    assert.ok(!source.includes(writer), `${file} must not use ${writer}`);
  }
  // Components go through the service, never straight to the API client.
  if (file.startsWith("src/components/")) {
    assert.ok(
      !/\bapi(Get|Post)\b/.test(source),
      `${file} must use the service`,
    );
  }
}

console.log("logistics-orders.ts: all checks passed");
