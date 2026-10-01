/**
 * Self-check for the customer-journey model. No test runner is configured, so this is a
 * plain assert script compiled with the repo's own TypeScript (the `format.check.ts` rule):
 *
 *     npx tsc src/lib/audit-journey.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/audit-journey.check.js
 *
 * Run from the repository root: the last block reads the journey's source files. The
 * payloads mirror what the backend writers record (`lead-audit.ts`, `logistics-conversion.ts`,
 * `logistics-orders.service.ts`), plus shapes no writer produces today.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  AUDIT_EVENTS_PATH,
  JOURNEY_PAGE_SIZE,
  appendPage,
  auditEventsParams,
  describeAuditEvent,
  groupByDay,
  humanize,
  type AuditEvent,
} from "./audit-journey";

const LEAD = "11111111-1111-4111-8111-111111111111";
const ORDER = "33333333-3333-4333-8333-333333333333";
const AGENT = "22222222-2222-4222-8222-222222222222";
const STRANGER = "44444444-4444-4444-8444-444444444444";

let seq = 0;
const event = (overrides: Partial<AuditEvent> = {}): AuditEvent => ({
  id: `event-${++seq}`,
  entityType: "LEAD",
  entityId: LEAD,
  leadId: LEAD,
  action: "UPDATED",
  actorType: "USER",
  actorId: AGENT,
  source: "leads.edit",
  before: null,
  after: null,
  metadata: null,
  createdAt: "2026-09-23T08:00:00.000Z",
  ...overrides,
});

const users = new Map([[AGENT, "Priya Agent"]]);
const fields = new Map([
  ["name", "Customer Name"],
  ["primaryPhone", "Primary Phone"],
  ["assigneeIds", "Assigned"],
]);

// 1–3. The request: exactly the existing endpoint, the lead, and the page asked for.
assert.equal(AUDIT_EVENTS_PATH, "/audit/events");
const params = auditEventsParams(LEAD, 2, JOURNEY_PAGE_SIZE);
assert.equal(params.get("leadId"), LEAD);
assert.equal(params.get("page"), "2");
assert.equal(params.get("size"), "50");
assert.deepEqual([...params.keys()], ["leadId", "page", "size"]);
assert.ok(JOURNEY_PAGE_SIZE <= 200, "never more than the API's page cap");

// 4–5. Order: grouping keeps the API's oldest-first order, and an empty journey is empty.
assert.deepEqual(groupByDay([]), []);
const day1a = event({ createdAt: "2026-09-21T09:00:00.000Z" });
const day1b = event({ createdAt: "2026-09-21T10:00:00.000Z" });
const day2 = event({ createdAt: "2026-09-23T09:00:00.000Z" });
const groups = groupByDay([day1a, day1b, day2]);
assert.deepEqual(
  groups.map((group) => group.events.map((e) => e.id)),
  [[day1a.id, day1b.id], [day2.id]],
);
assert.equal(
  groups[0].at,
  day1a.createdAt,
  "a day is headed by its first event",
);

// A later page continues the list; a row that shifted between reads is not shown twice.
assert.deepEqual(
  appendPage([day1a, day1b], [day1b, day2]).map((e) => e.id),
  [day1a.id, day1b.id, day2.id],
);
assert.deepEqual(appendPage([], []), []);

// 6. LEAD events.
const created = describeAuditEvent(
  event({
    action: "CREATED",
    source: "leads.create",
    after: {
      name: "Acme Trading",
      primaryPhone: "971500000000",
      status: "New",
      lostReason: null,
      assigneeIds: [AGENT],
      tagIds: [],
      customFields: {},
      archived: false,
      callAttempts: 0,
    },
  }),
  { fields, users },
);
assert.equal(created.entity, "Lead");
assert.equal(created.title, "Created");
assert.equal(created.actor, "Priya Agent");
assert.deepEqual(created.rows, [
  { label: "Customer Name", after: "Acme Trading" },
  { label: "Primary Phone", after: "971500000000" },
  { label: "Status", after: "New" },
  { label: "Assigned", after: "Priya Agent" },
  { label: "Archived", after: "No" },
  { label: "Call Attempts", after: "0" },
]);

const converted = describeAuditEvent(
  event({
    action: "CONVERTED",
    before: { status: "HOT" },
    after: { status: "WON" },
    metadata: { orderId: ORDER },
  }),
  { fields, users },
);
assert.equal(converted.title, "Converted");
assert.deepEqual(converted.rows, [
  { label: "Status", before: "HOT", after: "WON" },
]);
assert.deepEqual(converted.notes, [{ label: "Order ID", value: "33333333…" }]);

const reassigned = describeAuditEvent(
  event({
    action: "REASSIGNED",
    before: { assigneeIds: [AGENT] },
    after: { assigneeIds: [STRANGER] },
  }),
  { fields, users },
);
assert.deepEqual(reassigned.rows, [
  { label: "Assigned", before: "Priya Agent", after: "44444444…" },
]);

// 7. LOGISTICS_ORDER events, including the operational detail the writers record.
const orderCreated = describeAuditEvent(
  event({
    entityType: "LOGISTICS_ORDER",
    entityId: ORDER,
    action: "CREATED",
    after: {
      orderNumber: 1001,
      status: "INITIAL",
      customerName: "Acme",
      email: null,
    },
  }),
);
assert.equal(orderCreated.entity, "Logistics Order");
assert.deepEqual(orderCreated.rows, [
  { label: "Order Number", after: "1001" },
  { label: "Status", after: "INITIAL" },
  { label: "Customer Name", after: "Acme" },
]);

const rejected = describeAuditEvent(
  event({
    entityType: "LOGISTICS_ORDER",
    action: "QC_REJECTED",
    source: "logistics.qc_reject",
    before: { status: "INITIAL" },
    after: { status: "QC_REJECTED" },
    metadata: { remarks: "Wrong delivery address" },
  }),
);
assert.equal(rejected.title, "QC Rejected");
assert.deepEqual(rejected.rows, [
  { label: "Status", before: "INITIAL", after: "QC_REJECTED" },
]);
assert.deepEqual(rejected.notes, [
  { label: "Remarks", value: "Wrong delivery address" },
]);

const dispatched = describeAuditEvent(
  event({
    entityType: "LOGISTICS_ORDER",
    action: "DISPATCHED",
    metadata: { awbNumber: "AWB-123", courier: null },
  }),
);
assert.deepEqual(
  dispatched.notes,
  [{ label: "AWB Number", value: "AWB-123" }],
  "an empty courier is left out rather than shown as a dash",
);
assert.equal(describeAuditEvent(event({ action: "RTO" })).title, "RTO");

// 8. Later phases' records render generically, through the same leadId.
const account = describeAuditEvent(
  event({
    entityType: "ACCOUNTS_ORDER",
    action: "CREATED",
    after: { status: "Initial" },
  }),
);
assert.equal(account.entity, "Accounts Order");
assert.deepEqual(account.rows, [{ label: "Status", after: "Initial" }]);
const payment = describeAuditEvent(
  event({ entityType: "PAYMENT", action: "PAYMENT_RECEIVED" }),
);
assert.equal(payment.entity, "Payment");
assert.equal(payment.title, "Payment Received");

// 9. Unknown types, actions and actors are humanised, never refused.
const future = describeAuditEvent(
  event({
    entityType: "SHIPMENT_LABEL",
    action: "PRINTED_AGAIN",
    actorType: "SCHEDULER",
    actorId: null,
  }),
);
assert.equal(future.entity, "Shipment Label");
assert.equal(future.title, "Printed Again");
assert.equal(future.actor, "Scheduler");
const blank = describeAuditEvent(
  event({ entityType: "", action: "", actorType: "" }),
);
assert.equal(blank.entity, "Record");
assert.equal(blank.title, "Change");
assert.equal(blank.actor, null);
assert.equal(
  describeAuditEvent(event({ actorType: "SYSTEM", actorId: null })).actor,
  "System",
);
assert.equal(
  describeAuditEvent(event({ actorId: STRANGER }), { users }).actor,
  null,
  "a user this screen cannot name shows no name — the id stays in the raw record",
);

// 10. Values render safely whatever their shape.
const mixed = describeAuditEvent(
  event({
    before: { flag: true, nested: { calls: 2 }, list: [1, "two"], gone: "x" },
    after: { flag: false, nested: { calls: 3 }, list: [], gone: null },
  }),
);
assert.deepEqual(mixed.rows, [
  { label: "Flag", before: "Yes", after: "No" },
  { label: "Nested", before: "Calls: 2", after: "Calls: 3" },
  { label: "List", before: "1, two", after: "—" },
  { label: "Gone", before: "x", after: "—" },
]);
const unchanged = describeAuditEvent(
  event({ before: { city: "Dubai" }, after: { city: "Dubai" } }),
);
assert.deepEqual(unchanged.rows, [], "an unchanged field is not a change");
const deleted = describeAuditEvent(
  event({ action: "DELETED", before: { name: "Acme", email: null } }),
);
assert.deepEqual(deleted.rows, [{ label: "Name", before: "Acme" }]);

// 11. Malformed or absent JSON never throws and never invents rows.
for (const bad of [null, undefined, "text", 42, [1, 2], true]) {
  const entry = describeAuditEvent(
    event({ before: bad, after: bad, metadata: bad }),
  );
  assert.deepEqual(entry.rows, [], `rows for ${JSON.stringify(bad)}`);
  assert.deepEqual(entry.notes, [], `notes for ${JSON.stringify(bad)}`);
}

// Humanising: title case, as the app's labels read, and the workflow's acronyms keep theirs.
assert.equal(humanize("QC_VERIFIED"), "QC Verified");
assert.equal(humanize("awbNumber"), "AWB Number");
assert.equal(humanize("assigneeIds"), "Assignee IDs");
assert.equal(humanize("LOGISTICS_ORDER"), "Logistics Order");
assert.equal(humanize("callAttempts"), "Call Attempts");
assert.equal(humanize(""), "");

// 13. Read-only: the journey's code imports no API call that writes.
for (const file of [
  "src/services/audit-service.ts",
  "src/components/leads/customer-journey.tsx",
]) {
  const source = readFileSync(file, "utf8");
  for (const writer of [
    "apiPost",
    "apiPut",
    "apiPatch",
    "apiDelete",
    "apiPostForm",
  ]) {
    assert.ok(!source.includes(writer), `${file} must not use ${writer}`);
  }
  assert.ok(!source.includes("<form"), `${file} must not render a form`);
}

console.log("audit-journey.ts: all checks passed");
