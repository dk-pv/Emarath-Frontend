/**
 * Self-check for the pipeline-access helpers and the move capability (ADR-0093). No test
 * runner is configured, so this is a plain assert script compiled with the repo's own
 * TypeScript (the `format.check.ts` rule), run from the repository root:
 *
 *     npx tsc src/lib/pipeline-access.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/pipeline-access.check.js
 */
import assert from "node:assert/strict";
import { can } from "../constants/permissions";
import type { UserRole } from "../constants/roles";
import { MOVE_PIPELINE_HINT, convertBlockReason } from "./pipeline-access";

// B12: Convert is off only once the pipeline's stages are known to hold no WON stage.
assert.equal(
  convertBlockReason(
    "Complaints",
    [{ name: "Intake" }, { name: "Resolved" }],
    "WON",
  ),
  "The “Complaints” pipeline has no WON stage, so its leads can’t be converted.",
);
assert.equal(
  convertBlockReason(
    "Lead Pipeline",
    [{ name: "New" }, { name: "WON" }],
    "WON",
  ),
  null,
);
assert.equal(convertBlockReason("Complaints", null, "WON"), null);
assert.match(convertBlockReason("Empty", [], "WON") ?? "", /no WON stage/);

// B5: only admins and sales managers move leads between pipelines — the backend's
// PIPELINE_MOVE_ROLES. Everyone else, and an unknown role, is refused.
const movers: Record<UserRole, boolean> = {
  SUPERADMIN: true,
  SALES_MANAGER: true,
  SALES_AGENT: false,
  CUSTOMER_SERVICE_AGENT: false,
  MARKETING_ANALYST: false,
  LOGISTICS_MANAGER: false,
  LOGISTICS_EXECUTIVE: false,
  ACCOUNTS_EXECUTIVE: false,
  QC: false,
};
for (const [role, expected] of Object.entries(movers)) {
  assert.equal(can(role as UserRole, "moveLeadPipelines"), expected, role);
}
assert.equal(can(null, "moveLeadPipelines"), false);
assert.match(MOVE_PIPELINE_HINT, /manager or an administrator/);

console.log("pipeline-access.check: all assertions passed");
