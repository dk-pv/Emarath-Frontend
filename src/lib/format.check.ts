/**
 * Self-check for the shared formatters. No test runner is configured, so this is a
 * plain assert script compiled with the repo's own TypeScript:
 *
 *     npx tsc src/lib/format.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop \
 *       && node .check/format.check.js
 *
 * Dates are formatted in the running machine's timezone (the same rule the browser
 * follows), so the cases below build their instants from local components.
 */
import assert from "node:assert/strict";
import {
  formatAED,
  formatAEDCompact,
  formatDate,
  formatDateTime,
  formatTime,
  initialsOf,
} from "./format";

const local = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
  sec = 0,
): string => new Date(y, m - 1, d, h, min, sec).toISOString();

// Dates — zero-padded day/month, 4-digit year.
assert.equal(formatDate(local(2026, 7, 16)), "16-07-2026");
assert.equal(formatDate(local(2026, 12, 1)), "01-12-2026");
assert.equal(
  formatDate("not-a-date"),
  "not-a-date",
  "unparseable passes through",
);

// Times — 12-hour, optional seconds, optional padded hour.
assert.equal(formatTime(local(2026, 7, 16, 11, 39)), "11:39 AM");
assert.equal(formatTime(local(2026, 7, 16, 16, 25)), "4:25 PM");
assert.equal(
  formatTime(local(2026, 7, 16, 16, 25), { padHour: true }),
  "04:25 PM",
);
assert.equal(
  formatTime(local(2026, 7, 16, 11, 56, 24), { seconds: true }),
  "11:56:24 AM",
);

// Combined — the Workpex list/detail stamp.
assert.equal(
  formatDateTime(local(2026, 7, 16, 11, 39)),
  "16-07-2026, 11:39 AM",
);
assert.equal(
  formatDateTime(local(2026, 6, 12, 11, 56, 24), { seconds: true }),
  "12-06-2026, 11:56:24 AM",
);

// Money — decimal strings from the API, dash for absent, dirham sign always.
assert.equal(formatAED("130"), "130.00 د.إ");
assert.equal(formatAED("1234.5"), "1,234.50 د.إ");
assert.equal(formatAED(null), "—", "no amount renders the muted dash");
assert.equal(formatAED("abc"), "—", "unparseable renders the dash, never NaN");
assert.equal(formatAED("130", { digits: 0 }), "130 د.إ");
assert.equal(formatAED(0, { digits: 0 }), "0 د.إ");

// Compact money — Kanban column totals.
assert.equal(formatAEDCompact("509"), "509 د.إ");
assert.equal(formatAEDCompact("1400"), "1.4K د.إ");
assert.equal(formatAEDCompact("16000"), "16K د.إ");
assert.equal(formatAEDCompact("2500000"), "2.5M د.إ");
assert.equal(formatAEDCompact("nonsense"), "0 د.إ");

// Initials — first + last, collapsing extra whitespace and middle names.
assert.equal(initialsOf("Sales Agent One"), "SO");
assert.equal(initialsOf("Marshook"), "M");
assert.equal(initialsOf("  ansar   uae  "), "AU");
assert.equal(initialsOf(""), "", "an empty name yields no initials");

console.log("format.ts: all checks passed");
