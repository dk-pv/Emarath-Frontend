/**
 * Self-check for the lead form's `customFields` payload. No test runner is configured, so
 * this is a plain assert script compiled with the repo's own TypeScript (the
 * `format.check.ts` rule), run from the repository root:
 *
 *     npx tsc src/lib/lead-custom-values.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict && \
 *       node .check/lead-custom-values.check.js
 */
import assert from "node:assert/strict";
import { customFieldsPayload } from "./lead-custom-values";

const tier = { id: "f-tier", key: "cf_tier" };
const note = { id: "f-note", key: "cf_note" };

// Definitions not loaded, or their fetch failed: the key is omitted, so the API keeps
// every value. `[]` here was the bug — it cleared them all.
assert.equal(customFieldsPayload(undefined, { cf_tier: "Gold" }), undefined);

// Definitions loaded and there are none: an explicit empty set.
assert.deepEqual(customFieldsPayload([], {}), []);

// An unrelated edit resubmits the prefilled values unchanged.
assert.deepEqual(
  customFieldsPayload([tier, note], { cf_tier: "Gold", cf_note: "VIP" }),
  [
    { fieldId: "f-tier", value: "Gold" },
    { fieldId: "f-note", value: "VIP" },
  ],
);

// A cleared field is dropped (the API then clears it); values are trimmed.
assert.deepEqual(
  customFieldsPayload([tier, note], { cf_tier: "  Gold ", cf_note: "   " }),
  [{ fieldId: "f-tier", value: "Gold" }],
);

// A value for a field outside the definitions (an inactive one) is never sent: the API
// would refuse it, and keeps it on its own.
assert.deepEqual(
  customFieldsPayload([tier], { cf_tier: "Gold", cf_old: "Legacy" }),
  [{ fieldId: "f-tier", value: "Gold" }],
);

// A defined field the lead has no value for sends nothing.
assert.deepEqual(customFieldsPayload([tier, note], {}), []);

console.log("lead-custom-values: all checks passed");
