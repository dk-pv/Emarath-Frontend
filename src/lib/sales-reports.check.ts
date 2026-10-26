/**
 * Self-check for the Analytics Sales reports' drawing rules. No test runner is configured, so
 * this is a plain assert script compiled with the repo's own TypeScript (the `format.check.ts`
 * rule), run from the repository root:
 *
 *     npx tsc src/lib/sales-reports.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/sales-reports.check.js
 *
 * The reports' figures are the server's (`sales-funnel-report.spec.ts`,
 * `sales-pipeline-report.spec.ts`); these are how the page draws them, from the Oct 2026 captures.
 */
import assert from "node:assert/strict";
import {
  chipLabel,
  coveragePosition,
  formatCount,
  formatCoverage,
  formatRatio,
  funnelWidths,
  lowestStep,
  pipelineInitials,
  stepRatio,
} from "./sales-reports";

// The step badges: next ÷ previous, hidden after an empty step.
assert.equal(formatRatio(stepRatio(18, 1) ?? -1), "5.6%");
assert.equal(formatRatio(stepRatio(1, 1) ?? -1), "100%");
assert.equal(formatRatio(stepRatio(3, 11) ?? -1), "366.7%");
assert.equal(formatRatio(stepRatio(7309, 673) ?? -1), "9.2%");
assert.equal(formatRatio(stepRatio(39, 0) ?? -1), "0%");
assert.equal(stepRatio(0, 2), null);

// The warned badge is the steepest drop shown (Oct Full: 2.1 % warned, 3.2 % and 3.5 % plain).
assert.equal(lowestStep([null, 9.1, 3.5, 2.1, 3.2, null]), 2.1);
assert.equal(lowestStep([null, null]), null);

// Chip labels past eight characters are cut to eight and "..".
assert.equal(chipLabel("Last 30 Days"), "Last 30 ..");
assert.equal(chipLabel("Today"), "Today");
assert.equal(chipLabel("This Week"), "This Wee..");

// Widths: linear between the smallest and largest step, from 37 % to 100 % (Oct captures).
const widths = funnelWidths([7358, 673, 553, 156, 2]);
assert.equal(widths[0], 1);
assert.equal(widths[4], 0.37);
// 156 leads: 222 + 154/7,356 of the 375px span ≈ 230px of 597 in the capture.
assert.ok(Math.abs(widths[3] * 597 - 230) < 1.5);
assert.deepEqual(funnelWidths([1, 1]), [1, 1]);
assert.deepEqual(funnelWidths([]), []);

// Coverage: two decimals and ×, a dash without a target; the marker clamps to 0×–5×+.
assert.equal(formatCoverage(0), "0.00×");
assert.equal(formatCoverage(2.5), "2.50×");
assert.equal(formatCoverage(null), "—");
assert.equal(coveragePosition(1.5), 30);
assert.equal(coveragePosition(3), 60);
assert.equal(coveragePosition(-2), 0);
assert.equal(coveragePosition(1e9), 100);

// Counts and the pipeline's code under each stage name.
assert.equal(formatCount(4716), "4,716");
assert.equal(pipelineInitials("Lead Pipeline"), "LP");
assert.equal(pipelineInitials("QC"), "Q");

console.log("sales-reports.check: all assertions passed");
