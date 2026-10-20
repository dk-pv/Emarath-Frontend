/**
 * Self-check for the Teams screen's rules (Teams v1). No test runner is configured, so this is a
 * plain assert script compiled with the repo's own TypeScript (the `format.check.ts` rule), run
 * from the repository root:
 *
 *     npx tsc src/lib/teams.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/teams.check.js
 */
import assert from "node:assert/strict";
import {
  candidateLabel,
  candidatesFor,
  membersOf,
  movingFrom,
  normalizeTeamName,
  teamNameError,
  type TeamMemberEntry,
} from "./teams";

const member = (over: Partial<TeamMemberEntry>): TeamMemberEntry => ({
  id: "u",
  name: "Member",
  role: "SALES_AGENT",
  roleName: null,
  team: null,
  isActive: true,
  monthlyGoalAmount: null,
  eligible: true,
  ...over,
});

// The server's normalisation, exactly.
assert.equal(normalizeTeamName("  UAE   Team\t2 "), "UAE Team 2");

// Empty, too long, and duplicates in any case are refused; a valid new name is not.
const teams = ["Alpha", "Bravo"];
assert.equal(teamNameError("   ", teams), "Enter a team name.");
assert.match(teamNameError("x".repeat(121), teams) ?? "", /at most 120/);
assert.equal(teamNameError("x".repeat(120), teams), null);
assert.equal(
  teamNameError(" alpha ", teams),
  'A team named "Alpha" already exists.',
);
assert.equal(teamNameError("Charlie", teams), null);
// Renaming a team to its own name in another case is allowed; onto another team's is not.
assert.equal(teamNameError("ALPHA", teams, "Alpha"), null);
assert.equal(
  teamNameError("bravo", teams, "Alpha"),
  'A team named "Bravo" already exists.',
);

const ana = member({ id: "a", name: "Ana", team: "Alpha" });
const ben = member({ id: "b", name: "Ben", team: null });
const cy = member({ id: "c", name: "Cy", team: "Bravo", isActive: false });
const logi = member({
  id: "l",
  name: "Logi",
  role: "LOGISTICS_EXECUTIVE",
  eligible: false,
});
const everyone = [ana, ben, cy, logi];

assert.deepEqual(
  membersOf(everyone, "Alpha").map((row) => row.id),
  ["a"],
);
// Candidates: sales users not already in the team; post-sale roles never. A new team may take
// any sales user, the ones in no team included.
assert.deepEqual(
  candidatesFor(everyone, "Alpha").map((row) => row.id),
  ["b", "c"],
);
assert.deepEqual(
  candidatesFor(everyone, null).map((row) => row.id),
  ["a", "b", "c"],
);
assert.equal(candidateLabel(ana), "Ana (in Alpha)");
assert.equal(candidateLabel(ben), "Ben");
assert.equal(candidateLabel(cy), "Cy (in Bravo, inactive)");
assert.equal(
  candidateLabel(member({ name: "Dee", isActive: false })),
  "Dee (inactive)",
);
// Adding Ana and Ben to Bravo moves Ana out of Alpha; Ben had no team.
assert.deepEqual(
  movingFrom(everyone, ["a", "b"], "Bravo").map((row) => row.id),
  ["a"],
);

console.log("teams.check: all assertions passed");
