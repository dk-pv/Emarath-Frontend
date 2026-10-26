/**
 * Custom date + time ranges (client request 2026-10-13: custom filters took a date only).
 *
 * A range bound is a calendar day plus an OPTIONAL local time of day. This is the one
 * place a picked day/time becomes the ISO instants every range filter sends, so the Leads
 * filter builder, the Reports By Date panel, the Call Dashboard and the Activities filter
 * all mean the same thing by "10:00 AM to 3:00 PM".
 *
 * Timezone (ADR-0028 §3): days and times are read in the user's own timezone and leave
 * the browser as ISO instants; the API compares instants against TIMESTAMP columns and
 * never sees a wall-clock string.
 *
 * The server compares half-open `[from, to)`, and both bounds are inclusive at the unit
 * the user picked:
 *   From, no time → the start of that day.   From + time → that minute.
 *   To,   no time → the whole day (the next midnight — what a date-only range has always
 *                   sent).                   To + time → through that minute (one minute on).
 * A date-only range therefore produces exactly the instants it did before times existed.
 */

/** A local time of day as `HH:mm`, 24-hour — the value a native `<input type="time">` holds. */
export type TimeOfDay = string;

/** One end of a range: a day (null until picked) and the time within it (null = unset). */
export type DateTimeBound = { day: Date | null; time: TimeOfDay | null };

export const EMPTY_BOUND: DateTimeBound = { day: null, time: null };

const TIME_OF_DAY = /^([01]\d|2[0-3]):([0-5]\d)$/;
const BOUND_KEY = /^(\d{4})-(\d{2})-(\d{2})(?:T(([01]\d|2[0-3]):[0-5]\d))?$/;

const MINUTE_MS = 60_000;

export function isTimeOfDay(value: unknown): value is TimeOfDay {
  return typeof value === "string" && TIME_OF_DAY.test(value);
}

/** The first instant a bound covers: its minute, or midnight when no time is set. */
export function boundStart(day: Date, time?: TimeOfDay | null): Date {
  const [hour, minute] = isTimeOfDay(time)
    ? time.split(":").map(Number)
    : [0, 0];
  return new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    hour,
    minute,
  );
}

/**
 * The first instant AFTER a bound — the exclusive upper edge the API takes. Calendar
 * arithmetic for the day (a day is not always 24h), elapsed time for the minute.
 */
export function boundEnd(day: Date, time?: TimeOfDay | null): Date {
  if (!isTimeOfDay(time)) {
    return new Date(day.getFullYear(), day.getMonth(), day.getDate() + 1);
  }
  return new Date(boundStart(day, time).getTime() + MINUTE_MS);
}

const pad = (n: number) => String(n).padStart(2, "0");

export type Meridiem = "AM" | "PM";

/** A time on the 12-hour clock the app shows everywhere: hour 1–12, minute 0–59. */
export type TimeParts = { hour: number; minute: number; meridiem: Meridiem };

/** `15:07` → 3:07 PM. Midnight is 12 AM and noon 12 PM, as on any clock. */
export function timeParts(time: TimeOfDay): TimeParts {
  const [hour24, minute] = time.split(":").map(Number);
  return {
    hour: hour24 % 12 || 12,
    minute,
    meridiem: hour24 < 12 ? "AM" : "PM",
  };
}

/** The inverse of `timeParts`. */
export function timeFromParts({
  hour,
  minute,
  meridiem,
}: TimeParts): TimeOfDay {
  return `${pad((hour % 12) + (meridiem === "PM" ? 12 : 0))}:${pad(minute)}`;
}

/** `h:mm AM` — the app's 12-hour time (lib/format.ts `formatTime`), from a stored `HH:mm`. */
export function formatTime12(time: TimeOfDay): string {
  const { hour, minute, meridiem } = timeParts(time);
  return `${hour}:${pad(minute)} ${meridiem}`;
}

/**
 * `YYYY-MM-DD`, plus `THH:mm` when a time is set — the form a bound takes in a URL or a
 * filter row. Existing date-only links (`from=2026-10-13`) are the no-time case.
 */
export function dateKey(day: Date, time?: TimeOfDay | null): string {
  const date = `${day.getFullYear()}-${pad(day.getMonth() + 1)}-${pad(day.getDate())}`;
  return isTimeOfDay(time) ? `${date}T${time}` : date;
}

/** The inverse of `dateKey`; anything unparseable is an empty bound. */
export function keyBound(key: string | null | undefined): DateTimeBound {
  const match = key ? BOUND_KEY.exec(key) : null;
  if (!match) return EMPTY_BOUND;
  const [, year, month, date, time] = match;
  const day = new Date(Number(year), Number(month) - 1, Number(date));
  // Round-trip, not isNaN: `new Date(2026, 12, 99)` silently rolls over to a valid date.
  if (dateKey(day) !== `${year}-${month}-${date}`) return EMPTY_BOUND;
  return { day, time: time ?? null };
}

export const RANGE_ERROR = "The end can't be earlier than the start.";

/**
 * Why a range can't be applied, or null when it can — including when either end is
 * open. Compared as instants, so a same-day range needs an end time that is not before
 * its start time, and equal minutes are a valid one-minute window.
 */
export function rangeError(
  from: DateTimeBound,
  to: DateTimeBound,
): string | null {
  if (!from.day || !to.day) return null;
  const start = boundStart(from.day, from.time).getTime();
  const end = boundEnd(to.day, to.time).getTime();
  return end <= start ? RANGE_ERROR : null;
}

/**
 * A custom range's keys (the Reports By Date URL carries them) as the `[from, to)` ISO
 * instants the report APIs take. An absent or unparseable key leaves that side open.
 */
export function keyRange(
  from?: string,
  to?: string,
): { from?: string; to?: string } {
  const start = keyBound(from);
  const end = keyBound(to);
  return {
    from: start.day
      ? boundStart(start.day, start.time).toISOString()
      : undefined,
    to: end.day ? boundEnd(end.day, end.time).toISOString() : undefined,
  };
}

/**
 * A Leads filter date row — On / Before / After / Between / Not Between — as the
 * half-open boundaries its `conditions` entry carries, which the API compares `>=` / `<`:
 *
 *   on → [start, end)   before → [start]   after → [end]   (not) between → [start₁, end₂]
 *
 * where start and end are the bound's own edges (`boundStart` / `boundEnd`), so an
 * operator with no time means exactly the whole day it always did. A timestamp column
 * gets ISO instants; a DATE column (`dateOnly`) gets calendar days and ignores any time,
 * having none to filter on. Unparseable keys encode nothing.
 */
export function dateOperatorBoundaries(
  op: string,
  keys: string[],
  dateOnly: boolean,
): string[] {
  const edge = (key: string | undefined, which: "start" | "end") => {
    const { day, time } = keyBound(key);
    if (!day) return null;
    if (which === "start") {
      return dateOnly ? dateKey(day) : boundStart(day, time).toISOString();
    }
    return dateOnly
      ? dateKey(boundEnd(day))
      : boundEnd(day, time).toISOString();
  };
  let edges: (string | null)[];
  switch (op) {
    case "on":
      edges = [edge(keys[0], "start"), edge(keys[0], "end")];
      break;
    case "before":
      edges = [edge(keys[0], "start")];
      break;
    case "after":
      edges = [edge(keys[0], "end")];
      break;
    case "between":
    case "notBetween":
      edges = [edge(keys[0], "start"), edge(keys[1], "end")];
      break;
    default:
      return [];
  }
  return edges.every((value): value is string => value !== null) ? edges : [];
}

const CALENDAR_DAY = /^\d{4}-\d{2}-\d{2}$/;

/** A stored boundary — an ISO instant, or a calendar day (a DATE column) — as a local Date. */
function boundaryDate(value: string | undefined): Date | null {
  if (!value) return null;
  let at: Date;
  if (CALENDAR_DAY.test(value)) {
    const [year, month, day] = value.split("-").map(Number);
    at = new Date(year, month - 1, day);
  } else {
    at = new Date(value);
  }
  return Number.isNaN(at.getTime()) ? null : at;
}

const isMidnight = (at: Date) => at.getHours() === 0 && at.getMinutes() === 0;
const hhmm = (at: Date) => `${pad(at.getHours())}:${pad(at.getMinutes())}`;

/**
 * The key a stored START boundary (the first instant included) was picked as. A midnight
 * start is the bare day: no time, and 12:00 AM, select the same instants.
 */
function startKey(value: string | undefined): string {
  const at = boundaryDate(value);
  if (!at) return "";
  return dateKey(at, isMidnight(at) ? null : hhmm(at));
}

/**
 * The key a stored END boundary (the exclusive upper edge) was picked as: the day before
 * a midnight edge — the whole day — otherwise the minute before it. That minute keeps
 * its time even at 12:00 AM, which is not the same range as the bare day.
 */
function endKey(value: string | undefined): string {
  const at = boundaryDate(value);
  if (!at) return "";
  if (isMidnight(at)) {
    return dateKey(new Date(at.getFullYear(), at.getMonth(), at.getDate() - 1));
  }
  const last = new Date(at.getTime() - MINUTE_MS);
  return dateKey(last, hhmm(last));
}

/**
 * The end of a Meeting or Task moved to start at `dueAt`, keeping its length; null when it has
 * no end. Sent with every reschedule: without it a later day put the end before the start, which
 * the API refuses, and an earlier one stretched the meeting across days.
 */
export function rescheduledEnd(
  activity: { dueAt: string; endAt: string | null },
  dueAt: string,
): string | null {
  if (!activity.endAt) return null;
  const length = Date.parse(activity.endAt) - Date.parse(activity.dueAt);
  return new Date(Date.parse(dueAt) + length).toISOString();
}

/**
 * The inverse of `dateOperatorBoundaries` — a saved preset's or deep link's stored
 * boundaries back to the day(s) and times a builder row shows. Boundaries may be
 * instants or calendar days; presets saved before times existed hold only midnight
 * edges, which read back as bare days. A boundary that can't be read comes back as ""
 * (an incomplete row to fix) rather than throwing.
 */
export function dateOperatorKeys(op: string, boundaries: string[]): string[] {
  switch (op) {
    case "on":
    case "before":
      return [startKey(boundaries[0])];
    case "after":
      return [endKey(boundaries[0])];
    case "between":
    case "notBetween":
      return [startKey(boundaries[0]), endKey(boundaries[1])];
    default:
      return [];
  }
}
