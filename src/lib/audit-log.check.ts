/**
 * Self-check for the Audit Log screen's model (AUD-02). No test runner is configured, so this is a
 * plain assert script compiled with the repo's own TypeScript (the `format.check.ts` rule), run
 * from the repository root:
 *
 *     npx tsc src/lib/audit-log.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/audit-log.check.js
 */
import assert from "node:assert/strict";
import {
  AUDIT_LOG_FILTER_OPTIONS_PATH,
  AUDIT_LOG_PATH,
  NO_AUDIT_LOG_FILTERS,
  auditActorLabel,
  auditActorNames,
  auditLogParams,
  auditLogRangeError,
  entityTypeLabel,
  isAuditLogFiltered,
  type AuditLogRow,
} from "./audit-log";

const row = (over: Partial<AuditLogRow> = {}): AuditLogRow => ({
  id: "e1",
  entityType: "USER",
  entityId: "u2",
  leadId: null,
  action: "ROLE_CHANGED",
  actorType: "USER",
  actorId: "u1",
  source: "users.update",
  before: null,
  after: null,
  metadata: null,
  createdAt: "2026-10-20T08:00:00.000Z",
  actorName: "ZZ Admin",
  entityLabel: "ZZ Agent",
  ...over,
});

// The routes the service calls.
assert.equal(AUDIT_LOG_PATH, "/audit/log");
assert.equal(AUDIT_LOG_FILTER_OPTIONS_PATH, "/audit/log/filter-options");

// No filter: just the page.
assert.equal(
  auditLogParams(NO_AUDIT_LOG_FILTERS, 1, 25).toString(),
  "page=1&size=25",
);

// Every filter, with the days as the browser's own [start of From, start of the day after To).
{
  const from = new Date(2026, 9, 1);
  const to = new Date(2026, 9, 20);
  const params = auditLogParams(
    { entityType: "ROLE", actorId: "u1", from, to },
    3,
    50,
  );
  assert.equal(params.get("page"), "3");
  assert.equal(params.get("size"), "50");
  assert.equal(params.get("entityType"), "ROLE");
  assert.equal(params.get("actorId"), "u1");
  assert.equal(params.get("from"), new Date(2026, 9, 1).toISOString());
  assert.equal(params.get("to"), new Date(2026, 9, 21).toISOString());
}

// One open end is sent on its own.
{
  const params = auditLogParams(
    { ...NO_AUDIT_LOG_FILTERS, from: new Date(2026, 9, 5) },
    1,
    10,
  );
  assert.equal(params.has("to"), false);
  assert.equal(params.get("from"), new Date(2026, 9, 5).toISOString());
}

// A range: the same day is valid, an end before the start is not, an open end never is wrong.
assert.equal(
  auditLogRangeError({
    ...NO_AUDIT_LOG_FILTERS,
    from: new Date(2026, 9, 20),
    to: new Date(2026, 9, 20),
  }),
  null,
);
assert.notEqual(
  auditLogRangeError({
    ...NO_AUDIT_LOG_FILTERS,
    from: new Date(2026, 9, 20),
    to: new Date(2026, 9, 19),
  }),
  null,
);
assert.equal(
  auditLogRangeError({ ...NO_AUDIT_LOG_FILTERS, to: new Date(2026, 9, 19) }),
  null,
);

// "Filtered" is any filter set — it decides which empty state the screen shows.
assert.equal(isAuditLogFiltered(NO_AUDIT_LOG_FILTERS), false);
assert.equal(
  isAuditLogFiltered({ ...NO_AUDIT_LOG_FILTERS, actorId: "u1" }),
  true,
);
assert.equal(
  isAuditLogFiltered({ ...NO_AUDIT_LOG_FILTERS, to: new Date() }),
  true,
);

// Labels read as the Journey's.
assert.equal(entityTypeLabel("TAG_ACCESS_POLICY"), "Tag Access Policy");
assert.equal(entityTypeLabel("LOGISTICS_ORDER"), "Logistics Order");
assert.equal(entityTypeLabel(""), "Record");
assert.equal(auditActorLabel(row()), "ZZ Admin");
assert.equal(auditActorLabel(row({ actorName: null })), "Unknown user");
assert.equal(
  auditActorLabel(row({ actorType: "SYSTEM", actorId: null, actorName: null })),
  "System",
);
assert.equal(
  auditActorLabel(row({ actorType: "INTEGRATION", actorId: null })),
  "Integration",
);

// The drawer's name lookup comes from the rows themselves; an automation adds nothing.
assert.deepEqual(
  [
    ...auditActorNames([
      row(),
      row({ id: "e2", actorId: "u3", actorName: "ZZ Agent" }),
      row({ id: "e3", actorType: "SYSTEM", actorId: null, actorName: null }),
    ]),
  ],
  [
    ["u1", "ZZ Admin"],
    ["u3", "ZZ Agent"],
  ],
);

console.log("audit-log.check: all assertions passed");
