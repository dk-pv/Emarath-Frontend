/**
 * Self-check for custom date + time ranges. No test runner is configured, so this is a
 * plain assert script compiled with the repo's own TypeScript (the `format.check.ts`
 * rule), run from the repository root. Days and times resolve in the machine's timezone,
 * so run it under several to prove no date shifts:
 *
 *     npx tsc src/lib/date-time-range.check.ts --outDir .check --module commonjs \
 *       --target es2022 --moduleResolution node --esModuleInterop --strict \
 *       && for tz in UTC Asia/Dubai America/New_York Pacific/Kiritimati; do \
 *            TZ=$tz node .check/date-time-range.check.js; done
 *
 * Cases build their expected instants from local components (TZ-agnostic); the Dubai run
 * also pins literal UTC strings, the one place a real offset is asserted.
 */
import assert from "node:assert/strict";
import {
  boundEnd,
  boundStart,
  dateKey,
  dateOperatorBoundaries,
  dateOperatorKeys,
  formatTime12,
  isTimeOfDay,
  keyBound,
  keyRange,
  rangeError,
  RANGE_ERROR,
  timeFromParts,
  timeParts,
} from "./date-time-range";

const local = (
  y: number,
  m: number,
  d: number,
  h = 0,
  min = 0,
  s = 0,
  ms = 0,
) => new Date(y, m - 1, d, h, min, s, ms);
const iso = (date: Date) => date.toISOString();
const day = (y: number, m: number, d: number) => local(y, m, d);

/** The server's comparison on every range filter: `gte from`, `lt to`. */
const inWindow = (at: Date, window: { from?: string; to?: string }) =>
  (window.from === undefined || at.getTime() >= Date.parse(window.from)) &&
  (window.to === undefined || at.getTime() < Date.parse(window.to));

// The pre-change implementation (activities-list-view / lead-filter-config / reports), kept
// here as the oracle: a date-only range must keep producing exactly these instants.
const legacyStart = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate()).toISOString();
const legacyNext = (d: Date) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).toISOString();

// TEST 1 — a date-only range is unchanged, across month, year and leap-day ends.
for (const d of [
  day(2026, 10, 13),
  day(2026, 1, 31),
  day(2026, 12, 31),
  day(2028, 2, 28),
  day(2028, 2, 29),
  day(2026, 3, 29), // an EU DST-change day: a day is not always 24h
  day(2026, 11, 1), // a US DST-change day
]) {
  assert.equal(iso(boundStart(d)), legacyStart(d), `start ${dateKey(d)}`);
  assert.equal(iso(boundEnd(d)), legacyNext(d), `end ${dateKey(d)}`);
  assert.equal(iso(boundStart(d, null)), legacyStart(d));
  assert.equal(iso(boundEnd(d, null)), legacyNext(d));
  const key = dateKey(d);
  assert.deepEqual(keyRange(key, key), {
    from: legacyStart(d),
    to: legacyNext(d),
  });
  assert.deepEqual(dateOperatorBoundaries("on", [key], false), [
    legacyStart(d),
    legacyNext(d),
  ]);
  assert.deepEqual(dateOperatorBoundaries("before", [key], false), [
    legacyStart(d),
  ]);
  assert.deepEqual(dateOperatorBoundaries("after", [key], false), [
    legacyNext(d),
  ]);
  assert.deepEqual(dateOperatorBoundaries("between", [key, key], false), [
    legacyStart(d),
    legacyNext(d),
  ]);
}
// Existing links and one-sided ranges keep working.
assert.deepEqual(keyRange("2026-10-13", undefined), {
  from: legacyStart(day(2026, 10, 13)),
  to: undefined,
});
assert.deepEqual(keyRange(undefined, "2026-10-13"), {
  from: undefined,
  to: legacyNext(day(2026, 10, 13)),
});
assert.deepEqual(keyRange(undefined, undefined), {
  from: undefined,
  to: undefined,
});

// TEST 2 — a custom start date + time is that minute.
assert.equal(
  iso(boundStart(day(2026, 10, 13), "10:00")),
  iso(local(2026, 10, 13, 10, 0)),
);
assert.equal(
  iso(boundStart(day(2026, 10, 13), "15:07")),
  iso(local(2026, 10, 13, 15, 7)),
);

// TEST 3 — a custom end date + time includes its own minute: the edge is one minute on.
assert.equal(
  iso(boundEnd(day(2026, 10, 13), "15:00")),
  iso(local(2026, 10, 13, 15, 1)),
);
assert.equal(
  iso(boundEnd(day(2026, 10, 13), "23:59")),
  iso(boundEnd(day(2026, 10, 13))),
  "an end of 11:59 PM is the whole day",
);

// TESTS 4–6 — 10:00 AM to 3:00 PM on one day.
{
  const window = keyRange("2026-10-13T10:00", "2026-10-13T15:00");
  assert.deepEqual(window, {
    from: iso(local(2026, 10, 13, 10, 0)),
    to: iso(local(2026, 10, 13, 15, 1)),
  });
  const at = (h: number, m: number, s = 0, ms = 0) =>
    inWindow(local(2026, 10, 13, h, m, s, ms), window);
  assert.equal(at(9, 59, 59, 999), false, "before 10:00 AM is excluded");
  assert.equal(at(0, 0), false, "midnight is excluded");
  assert.equal(at(10, 0), true, "10:00:00 is the first included instant");
  assert.equal(at(12, 30), true);
  assert.equal(at(15, 0), true, "3:00:00 PM is included");
  assert.equal(
    at(15, 0, 59, 999),
    true,
    "the whole 3:00 PM minute is included",
  );
  assert.equal(at(15, 1), false, "after 3:00 PM is excluded");
  assert.equal(at(23, 59, 59, 999), false);
  assert.equal(
    inWindow(local(2026, 10, 12, 12, 0), window) ||
      inWindow(local(2026, 10, 14, 12, 0), window),
    false,
    "neighbouring days are excluded",
  );
}

// TEST 7 — a range across days.
{
  const window = keyRange("2026-10-13T22:00", "2026-10-15T06:00");
  assert.equal(inWindow(local(2026, 10, 13, 21, 59), window), false);
  assert.equal(inWindow(local(2026, 10, 13, 22, 0), window), true);
  assert.equal(inWindow(local(2026, 10, 14, 12, 0), window), true);
  assert.equal(inWindow(local(2026, 10, 15, 6, 0, 30), window), true);
  assert.equal(inWindow(local(2026, 10, 15, 6, 1), window), false);
  // A month and a year boundary.
  const wide = keyRange("2026-12-31T23:30", "2027-01-01T00:30");
  assert.equal(inWindow(local(2026, 12, 31, 23, 29), wide), false);
  assert.equal(inWindow(local(2026, 12, 31, 23, 30), wide), true);
  assert.equal(inWindow(local(2027, 1, 1, 0, 30, 59), wide), true);
  assert.equal(inWindow(local(2027, 1, 1, 0, 31), wide), false);
}

// TEST 8 — invalid ranges and malformed values.
{
  const b = (key: string) => keyBound(key);
  assert.equal(
    rangeError(b("2026-10-13T15:00"), b("2026-10-13T10:00")),
    RANGE_ERROR,
  );
  assert.equal(rangeError(b("2026-10-14"), b("2026-10-13")), RANGE_ERROR);
  assert.equal(
    rangeError(b("2026-10-14T00:00"), b("2026-10-13T23:59")),
    RANGE_ERROR,
  );
  assert.equal(rangeError(b("2026-10-13T10:00"), b("2026-10-13T10:00")), null);
  assert.equal(rangeError(b("2026-10-13T10:00"), b("2026-10-13T10:01")), null);
  assert.equal(rangeError(b("2026-10-13T10:00"), b("2026-10-13")), null);
  assert.equal(rangeError(b("2026-10-13"), b("2026-10-13T00:00")), null);
  assert.equal(rangeError(b("2026-10-13"), b("2026-10-13")), null);
  // An open end is never an error.
  assert.equal(rangeError(b("2026-10-13T15:00"), b("")), null);
  assert.equal(rangeError(b(""), b("2026-10-13T10:00")), null);

  for (const bad of [
    "",
    "13-10-2026",
    "2026-13-01",
    "2026-02-30",
    "2026-10-13T25:00",
    "2026-10-13T10:60",
    "2026-10-13T9:00",
    "2026-10-13T10:00:00",
    "2026-10-13T10:00Z",
    "2026-10-13 10:00",
    "0050-01-01",
    "garbage",
  ]) {
    assert.equal(keyBound(bad).day, null, `${bad} is no bound`);
    assert.deepEqual(keyRange(bad, bad), { from: undefined, to: undefined });
  }
  assert.equal(keyBound(undefined).day, null);
  assert.equal(keyBound(null).day, null);

  for (const bad of [
    "24:00",
    "9:00",
    "10:5",
    "10:60",
    "1000",
    "",
    "10:00:00",
    "AM",
  ]) {
    assert.equal(isTimeOfDay(bad), false, `${bad} is no time`);
  }
  for (const good of ["00:00", "09:05", "12:00", "23:59"]) {
    assert.equal(isTimeOfDay(good), true);
  }
  // A time that is not a time is treated as no time, never as a shifted one.
  assert.equal(
    iso(boundStart(day(2026, 10, 13), "25:00")),
    legacyStart(day(2026, 10, 13)),
  );
  assert.equal(
    iso(boundEnd(day(2026, 10, 13), "nope")),
    legacyNext(day(2026, 10, 13)),
  );
}

// TEST 9 — midnight boundaries and key round trips.
{
  const d = day(2026, 10, 13);
  assert.equal(
    iso(boundStart(d, "00:00")),
    iso(boundStart(d)),
    "From 12:00 AM is the start of the day",
  );
  assert.equal(
    iso(boundEnd(d, "00:00")),
    iso(local(2026, 10, 13, 0, 1)),
    "To 12:00 AM is only the first minute — not the whole day",
  );
  assert.notEqual(iso(boundEnd(d, "00:00")), iso(boundEnd(d)));
  const midnight = keyRange("2026-10-13T00:00", "2026-10-13T00:00");
  assert.equal(inWindow(local(2026, 10, 13, 0, 0, 30), midnight), true);
  assert.equal(inWindow(local(2026, 10, 13, 0, 1), midnight), false);
  assert.equal(inWindow(local(2026, 10, 12, 23, 59, 59, 999), midnight), false);

  assert.equal(dateKey(d), "2026-10-13");
  assert.equal(dateKey(d, "10:00"), "2026-10-13T10:00");
  assert.equal(dateKey(d, "bad"), "2026-10-13");
  assert.deepEqual(keyBound("2026-10-13T10:00").time, "10:00");
  assert.equal(keyBound("2026-10-13").time, null);
  assert.equal(dateKey(day(2026, 1, 2)), "2026-01-02", "zero-padded");

  // The local-calendar day survives for a user whose timezone is far from UTC.
  for (const key of [
    "2026-01-01",
    "2026-12-31",
    "2026-10-13T00:00",
    "2026-10-13T23:59",
  ]) {
    const { day: parsed, time } = keyBound(key);
    assert.equal(dateKey(parsed!, time), key);
  }
}

// The Leads filter: operator boundaries and their round trip through saved presets.
{
  const keys = (...values: string[]) => values;
  // Timed rows.
  assert.deepEqual(
    dateOperatorBoundaries(
      "between",
      keys("2026-10-13T10:00", "2026-10-13T15:00"),
      false,
    ),
    [iso(local(2026, 10, 13, 10, 0)), iso(local(2026, 10, 13, 15, 1))],
  );
  assert.deepEqual(
    dateOperatorBoundaries("on", keys("2026-10-13T10:00"), false),
    [iso(local(2026, 10, 13, 10, 0)), iso(local(2026, 10, 13, 10, 1))],
    "On a time is that minute",
  );
  assert.deepEqual(
    dateOperatorBoundaries("before", keys("2026-10-13T10:00"), false),
    [iso(local(2026, 10, 13, 10, 0))],
  );
  assert.deepEqual(
    dateOperatorBoundaries("after", keys("2026-10-13T15:00"), false),
    [iso(local(2026, 10, 13, 15, 1))],
    "After a time is after that minute",
  );
  // A DATE column ignores time and sends calendar days.
  assert.deepEqual(
    dateOperatorBoundaries(
      "between",
      keys("2026-10-13T10:00", "2026-10-14T15:00"),
      true,
    ),
    ["2026-10-13", "2026-10-15"],
  );
  assert.deepEqual(dateOperatorBoundaries("on", keys("2026-12-31"), true), [
    "2026-12-31",
    "2027-01-01",
  ]);
  // Anything unparseable, or an operator with no boundaries, encodes nothing.
  assert.deepEqual(
    dateOperatorBoundaries("between", keys("2026-10-13", ""), false),
    [],
  );
  assert.deepEqual(
    dateOperatorBoundaries("between", keys("nope", "nope"), false),
    [],
  );
  assert.deepEqual(dateOperatorBoundaries("isEmpty", keys(), false), []);
  assert.deepEqual(
    dateOperatorBoundaries("contains", keys("2026-10-13"), false),
    [],
  );

  // Round trip: encode then decode returns the row as picked (a 12:00 AM start and an
  // 11:59 PM end read back as the bare day — the same instants).
  const cases: [string, string[], string[]][] = [
    ["on", keys("2026-10-13"), keys("2026-10-13")],
    ["on", keys("2026-10-13T10:00"), keys("2026-10-13T10:00")],
    ["before", keys("2026-10-13"), keys("2026-10-13")],
    ["before", keys("2026-10-13T09:30"), keys("2026-10-13T09:30")],
    ["after", keys("2026-10-13"), keys("2026-10-13")],
    ["after", keys("2026-10-13T15:00"), keys("2026-10-13T15:00")],
    ["after", keys("2026-10-13T23:59"), keys("2026-10-13")],
    ["after", keys("2026-10-13T00:00"), keys("2026-10-13T00:00")],
    [
      "between",
      keys("2026-10-13", "2026-10-15"),
      keys("2026-10-13", "2026-10-15"),
    ],
    [
      "between",
      keys("2026-10-13T10:00", "2026-10-13T15:00"),
      keys("2026-10-13T10:00", "2026-10-13T15:00"),
    ],
    [
      "between",
      keys("2026-10-13T00:00", "2026-10-13T23:59"),
      keys("2026-10-13", "2026-10-13"),
    ],
    [
      "notBetween",
      keys("2026-12-31T23:30", "2027-01-01T00:30"),
      keys("2026-12-31T23:30", "2027-01-01T00:30"),
    ],
    [
      "between",
      keys("2026-10-13T10:00", "2026-10-14"),
      keys("2026-10-13T10:00", "2026-10-14"),
    ],
    [
      "between",
      keys("2026-10-13", "2026-10-13T00:00"),
      keys("2026-10-13", "2026-10-13T00:00"),
    ],
  ];
  for (const [op, picked, expected] of cases) {
    const stored = dateOperatorBoundaries(op, picked, false);
    assert.deepEqual(
      dateOperatorKeys(op, stored),
      expected,
      `${op} ${picked.join(" → ")}`,
    );
  }

  // A preset saved before times existed: midnight instants (and calendar days for a DATE
  // column) read back as bare days — it must open exactly as it was saved.
  assert.deepEqual(
    dateOperatorKeys("between", [
      legacyStart(day(2026, 10, 13)),
      legacyNext(day(2026, 10, 15)),
    ]),
    ["2026-10-13", "2026-10-15"],
  );
  assert.deepEqual(
    dateOperatorKeys("on", [
      legacyStart(day(2026, 10, 13)),
      legacyNext(day(2026, 10, 13)),
    ]),
    ["2026-10-13"],
  );
  assert.deepEqual(dateOperatorKeys("after", [legacyNext(day(2026, 10, 13))]), [
    "2026-10-13",
  ]);
  assert.deepEqual(
    dateOperatorKeys("before", [legacyStart(day(2026, 10, 13))]),
    ["2026-10-13"],
  );
  assert.deepEqual(dateOperatorKeys("between", ["2026-10-13", "2026-10-15"]), [
    "2026-10-13",
    "2026-10-14",
  ]);
  // Damaged presets come back as incomplete rows, never as an exception.
  assert.deepEqual(dateOperatorKeys("between", ["", "garbage"]), ["", ""]);
  assert.deepEqual(dateOperatorKeys("before", []), [""]);
  assert.deepEqual(dateOperatorKeys("between", []), ["", ""]);
  assert.deepEqual(dateOperatorKeys("isEmpty", ["2026-10-13"]), []);
}

// The 12-hour clock the picker shows: every minute of the day round-trips, and reads as the
// app prints times elsewhere (lib/format.ts `formatTime`: `h:mm AM`).
{
  // Newer ICU puts a narrow no-break space before AM/PM; the picker uses a plain space.
  const SPACES = new RegExp("[" + String.fromCharCode(0x202f, 0xa0) + "]", "g");
  const two = (n: number) => String(n).padStart(2, "0");
  for (let h = 0; h < 24; h += 1) {
    for (let m = 0; m < 60; m += 1) {
      const time = `${two(h)}:${two(m)}`;
      const parts = timeParts(time);
      assert.ok(parts.hour >= 1 && parts.hour <= 12, `hour of ${time}`);
      assert.equal(parts.minute, m);
      assert.equal(parts.meridiem, h < 12 ? "AM" : "PM");
      assert.equal(timeFromParts(parts), time, `round trip ${time}`);
      assert.equal(isTimeOfDay(time), true);
      const printed = new Date(2026, 9, 13, h, m)
        .toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
        .replace(SPACES, " ");
      assert.equal(formatTime12(time), printed, `format ${time}`);
    }
  }
  assert.deepEqual(timeParts("00:00"), { hour: 12, minute: 0, meridiem: "AM" });
  assert.deepEqual(timeParts("12:00"), { hour: 12, minute: 0, meridiem: "PM" });
  assert.deepEqual(timeParts("00:30"), {
    hour: 12,
    minute: 30,
    meridiem: "AM",
  });
  assert.deepEqual(timeParts("23:59"), {
    hour: 11,
    minute: 59,
    meridiem: "PM",
  });
  assert.equal(formatTime12("15:00"), "3:00 PM");
  assert.equal(formatTime12("10:00"), "10:00 AM");
  assert.equal(formatTime12("00:00"), "12:00 AM");
  assert.equal(timeFromParts({ hour: 12, minute: 0, meridiem: "AM" }), "00:00");
  assert.equal(timeFromParts({ hour: 12, minute: 0, meridiem: "PM" }), "12:00");
  assert.equal(timeFromParts({ hour: 3, minute: 5, meridiem: "PM" }), "15:05");
}

// A zone with DST: the day edge is calendar arithmetic, so a day is 23h or 25h on a change
// day, and an 11:59 PM end still lands on the next midnight.
if (process.env.TZ === "America/New_York") {
  const HOUR = 3_600_000;
  const length = (d: Date) => boundEnd(d).getTime() - boundStart(d).getTime();
  assert.equal(length(day(2026, 3, 8)), 23 * HOUR, "spring-forward day");
  assert.equal(length(day(2026, 11, 1)), 25 * HOUR, "fall-back day");
  assert.equal(length(day(2026, 10, 13)), 24 * HOUR);
  for (const d of [day(2026, 3, 8), day(2026, 11, 1)]) {
    assert.equal(iso(boundEnd(d, "23:59")), iso(boundEnd(d)));
    assert.equal(iso(boundStart(d, "00:00")), iso(boundStart(d)));
  }
}

// The real offset: pinned only when run as UAE time (UTC+4, no DST).
if (process.env.TZ === "Asia/Dubai") {
  assert.equal(
    iso(boundStart(day(2026, 10, 13), "10:00")),
    "2026-10-13T06:00:00.000Z",
  );
  assert.equal(
    iso(boundEnd(day(2026, 10, 13), "15:00")),
    "2026-10-13T11:01:00.000Z",
  );
  assert.equal(iso(boundStart(day(2026, 10, 13))), "2026-10-12T20:00:00.000Z");
  assert.equal(iso(boundEnd(day(2026, 10, 13))), "2026-10-13T20:00:00.000Z");
  // 12:30 AM Dubai on the 13th is still the 12th in UTC — the key must stay the 13th.
  assert.deepEqual(keyRange("2026-10-13T00:30", "2026-10-13T00:45"), {
    from: "2026-10-12T20:30:00.000Z",
    to: "2026-10-12T20:46:00.000Z",
  });
  assert.deepEqual(
    dateOperatorKeys("between", [
      "2026-10-12T20:30:00.000Z",
      "2026-10-12T20:46:00.000Z",
    ]),
    ["2026-10-13T00:30", "2026-10-13T00:45"],
  );
}

console.log(
  `date-time-range.check: all assertions passed (TZ=${process.env.TZ ?? "system"})`,
);
