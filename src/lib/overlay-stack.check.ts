/**
 * Self-check for the overlay stack behind every Escape-to-close overlay (`useDismissable`). No test
 * runner is configured, so this is a plain assert script compiled with the repo's own TypeScript
 * (the `format.check.ts` rule), run from the repository root:
 *
 *     npx tsc src/lib/overlay-stack.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && node .check/lib/overlay-stack.check.js
 */
import assert from "node:assert/strict";
import { claimEscape, closeOverlay, openOverlay } from "./overlay-stack";

const press = () => new Event("keydown");

// One overlay: it answers a press, and a press is answered once.
const lone = openOverlay();
const first = press();
assert.equal(claimEscape(first, lone), true);
assert.equal(claimEscape(first, lone), false, "one press, one answer");
closeOverlay(lone);

// A dropdown inside a popover, listeners in the order they opened: the popover hears the press
// first, while the dropdown is still innermost, and leaves it to the dropdown.
const popover = openOverlay();
const dropdown = openOverlay();
const second = press();
assert.equal(claimEscape(second, popover), false, "the outer overlay waits");
assert.equal(claimEscape(second, dropdown), true, "the innermost answers");

// The regression: the popover re-rendered while the dropdown was open (a choice applied at once),
// so its listener now runs AFTER the dropdown's — and React removes the closing dropdown from the
// stack between the two. The popover is then innermost, but this press is already answered.
const third = press();
assert.equal(claimEscape(third, dropdown), true);
closeOverlay(dropdown);
assert.equal(
  claimEscape(third, popover),
  false,
  "one Escape closes the dropdown only, never the popover with it",
);
// The next press is the popover's.
assert.equal(claimEscape(press(), popover), true);

// Closing an overlay removes that one only — even one already gone, which once removed the
// innermost instead.
const drawer = openOverlay();
const picker = openOverlay();
closeOverlay(dropdown);
assert.equal(
  claimEscape(press(), picker),
  true,
  "the picker is still innermost",
);
closeOverlay(picker);
closeOverlay(popover);
assert.equal(claimEscape(press(), drawer), true, "then the drawer");
closeOverlay(drawer);

// No overlay open: nothing answers.
assert.equal(claimEscape(press(), null), false);
assert.equal(claimEscape(press(), drawer), false);

console.log("overlay-stack.ts: all checks passed");
