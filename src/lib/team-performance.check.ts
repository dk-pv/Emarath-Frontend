/**
 * Self-check for the Team Performance report's helpers (Teams v1). No test runner is configured,
 * so this is a plain assert script compiled with the repo's own TypeScript (the `format.check.ts`
 * rule), run from the repository root:
 *
 *     npx tsc src/lib/team-performance.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/team-performance.check.js
 */
import assert from "node:assert/strict";
import {
  barShare,
  isTeamPerformanceEmpty,
  teamPerformanceParams,
  type TeamPerformanceResult,
} from "./team-performance";

// Unset filters send nothing; lists repeat their key; the default date field is implied.
assert.equal(
  teamPerformanceParams({
    team: [],
    agent: [],
    source: [],
    manager: null,
    dateField: "created",
  }).toString(),
  "",
);
assert.equal(
  teamPerformanceParams({
    from: "2026-10-01T00:00:00.000Z",
    to: "2026-11-01T00:00:00.000Z",
    dateField: "statusChanged",
    team: ["Alpha", "Bravo"],
    agent: ["a1"],
    source: ["Facebook"],
    manager: "m1",
  }).toString(),
  "from=2026-10-01T00%3A00%3A00.000Z&to=2026-11-01T00%3A00%3A00.000Z&dateField=statusChanged&manager=m1&team=Alpha&team=Bravo&agent=a1&source=Facebook",
);

// Bars are shares of the column's largest value; an all-zero column draws no bar.
assert.equal(barShare(5, [10, 5, 0]), 50);
assert.equal(barShare(10, [10, 5, 0]), 100);
assert.equal(barShare(0, [0, 0]), 0);
assert.equal(barShare(3, [3]), 100);

const empty: TeamPerformanceResult = {
  teams: [],
  people: [],
  total: { leads: 0, won: 0, orders: 0, conversionRate: 0, wonValue: "0" },
};
assert.equal(isTeamPerformanceEmpty(empty), true);
// A team member with nothing yet is still something to show.
assert.equal(
  isTeamPerformanceEmpty({
    ...empty,
    people: [
      {
        userId: "u",
        name: "Zed",
        team: "Alpha",
        leads: 0,
        won: 0,
        orders: 0,
        conversionRate: 0,
        wonValue: "0",
        target: null,
        achievement: null,
      },
    ],
  }),
  false,
);

console.log("team-performance.check: all assertions passed");
