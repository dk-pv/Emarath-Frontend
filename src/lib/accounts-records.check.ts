/**
 * Self-check for the Accounts screen's model and its menu capability (ADR-0096). No test runner
 * is configured, so this is a plain assert script compiled with the repo's own TypeScript (the
 * `format.check.ts` rule), run from the repository root:
 *
 *     npx tsc src/lib/accounts-records.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/accounts-records.check.js
 */
import assert from "node:assert/strict";
import { can } from "../constants/permissions";
import {
  ACCOUNTS_FILTER_OPTIONS_PATH,
  ACCOUNTS_RECORDS_PATH,
  ACCOUNTS_SORT_KEYS,
  ACCOUNTS_SUMMARY_PATH,
  DEFAULT_ACCOUNTS_SORT,
  PAYMENT_STATUSES,
  PAYMENT_STATUS_LABEL,
  accountsFilterParams,
  accountsRecordsParams,
  accountsUrlParams,
  correctionReasonError,
  correctionTargets,
  isPaymentStatus,
  parseAccountsUrl,
  paymentStatusLabel,
  recordsLoadError,
  refetchAfterRefusal,
} from "./accounts-records";

const LIMITS = {
  pageSizes: [10, 25, 50, 100],
  defaultSize: 50,
  searchMax: 200,
};
const RECORD = "44444444-4444-4444-8444-444444444444";

// ---------------------------------------------------------------------------------------------
// The vocabulary: the backend's PaymentStatus enum, in the specification's order (§6), with its
// names.
assert.deepEqual(
  [...PAYMENT_STATUSES],
  [
    "INITIAL",
    "PAYMENT_PENDING",
    "PAYMENT_RECEIVED",
    "PAYMENT_FAILED",
    "PARTIALLY_PAID",
  ],
);
assert.deepEqual(PAYMENT_STATUS_LABEL, {
  INITIAL: "Initial",
  PAYMENT_PENDING: "Payment Pending",
  PAYMENT_RECEIVED: "Payment Received",
  PAYMENT_FAILED: "Payment Failed",
  PARTIALLY_PAID: "Partially Paid",
});
assert.equal(paymentStatusLabel("PAYMENT_RECEIVED"), "Payment Received");
assert.equal(
  paymentStatusLabel("WRITTEN_OFF"),
  "WRITTEN_OFF",
  "an unknown status is shown raw, never blank",
);
assert.equal(isPaymentStatus("PARTIALLY_PAID"), true);
assert.equal(isPaymentStatus("DELIVERED"), false);

// A correction (Q14) reaches every other status, backwards included, never its own.
for (const from of PAYMENT_STATUSES) {
  assert.deepEqual(
    correctionTargets(from),
    PAYMENT_STATUSES.filter((status) => status !== from),
  );
}
assert.equal(correctionReasonError(""), "Enter the reason for the correction.");
assert.equal(
  correctionReasonError("   "),
  "Enter the reason for the correction.",
);
assert.equal(correctionReasonError("Bank reversal"), undefined);

// ---------------------------------------------------------------------------------------------
// The requests: the backend's paths and sort whitelist, filters repeated per value.
assert.equal(ACCOUNTS_RECORDS_PATH, "/accounts/records");
assert.equal(ACCOUNTS_SUMMARY_PATH, "/accounts/records/summary");
assert.equal(ACCOUNTS_FILTER_OPTIONS_PATH, "/accounts/records/filter-options");
assert.deepEqual(
  [...ACCOUNTS_SORT_KEYS],
  ["deliveredAt", "orderNumber", "customerName", "status", "statusChangedAt"],
);
assert.deepEqual(DEFAULT_ACCOUNTS_SORT, {
  key: "deliveredAt",
  direction: "desc",
});
assert.equal(
  accountsFilterParams({
    status: ["INITIAL", "PAYMENT_FAILED"],
    paymentMethod: ["COD"],
    courier: ["Aramex", "Tawaseel"],
    search: "  AWB-1  ",
  }).toString(),
  "status=INITIAL&status=PAYMENT_FAILED&paymentMethod=COD&courier=Aramex&courier=Tawaseel&search=AWB-1",
);
assert.equal(
  accountsFilterParams({ search: "   " }).toString(),
  "",
  "a blank search is no filter",
);
assert.equal(
  accountsRecordsParams({
    page: 2,
    size: 25,
    sort: "orderNumber",
    direction: "asc",
  }).toString(),
  "page=2&size=25&sort=orderNumber&direction=asc",
);

// ---------------------------------------------------------------------------------------------
// The address: a plain visit is the defaults; anything malformed falls back rather than reaching
// the API; a state round-trips.
const plain = parseAccountsUrl(new URLSearchParams(), LIMITS);
assert.deepEqual(plain, {
  status: [],
  paymentMethod: [],
  courier: [],
  q: "",
  page: 1,
  size: 50,
  sort: "deliveredAt",
  direction: "desc",
  record: null,
});
assert.equal(
  accountsUrlParams(plain, 50).toString(),
  "",
  "the defaults write nothing",
);
const messy = parseAccountsUrl(
  new URLSearchParams(
    `status=PAYMENT_FAILED&status=NOPE&status=INITIAL&paymentMethod=%20COD%20&paymentMethod=COD&paymentMethod=${"x".repeat(65)}&page=-2&size=7&sort=id;DROP&direction=up&record=nope&q=${"y".repeat(250)}`,
  ),
  LIMITS,
);
assert.deepEqual(
  messy.status,
  ["INITIAL", "PAYMENT_FAILED"],
  "known statuses only, in pipeline order",
);
assert.deepEqual(
  messy.paymentMethod,
  ["COD"],
  "trimmed, deduplicated, over-long dropped",
);
assert.equal(messy.page, 1);
assert.equal(messy.size, 50);
assert.equal(messy.sort, "deliveredAt");
assert.equal(messy.direction, "desc");
assert.equal(messy.record, null);
assert.equal(messy.q.length, 200);
const state = {
  status: ["PARTIALLY_PAID" as const],
  paymentMethod: ["Tabby"],
  courier: ["Aramex"],
  q: "#1001",
  page: 3,
  size: 25,
  sort: "orderNumber" as const,
  direction: "asc" as const,
  record: RECORD,
};
assert.deepEqual(parseAccountsUrl(accountsUrlParams(state, 50), LIMITS), state);

// ---------------------------------------------------------------------------------------------
// Refusals: what moved on (403, 404, 409) is read again; a form mistake (400) stays in the form.
assert.equal(refetchAfterRefusal(409), true);
assert.equal(refetchAfterRefusal(404), true);
assert.equal(refetchAfterRefusal(403), true);
assert.equal(refetchAfterRefusal(400), false);
assert.equal(refetchAfterRefusal(undefined), false);
assert.match(recordsLoadError(403), /doesn’t have access to Accounts/);
assert.match(recordsLoadError(400), /filters in this page’s address/);
assert.match(recordsLoadError(undefined), /connection/);

// ---------------------------------------------------------------------------------------------
// The menu follows the backend's readers: the Accounts Executive and the admin, nobody else.
for (const role of ["SUPERADMIN", "ACCOUNTS_EXECUTIVE"] as const) {
  assert.equal(can(role, "useAccounts"), true, `${role} sees Accounts`);
}
for (const role of [
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
  "LOGISTICS_MANAGER",
  "LOGISTICS_EXECUTIVE",
  "QC",
] as const) {
  assert.equal(
    can(role, "useAccounts"),
    false,
    `${role} does not see Accounts`,
  );
}
assert.equal(can(undefined, "useAccounts"), false, "no role, no menu");

console.log("accounts-records.check: all assertions passed");
