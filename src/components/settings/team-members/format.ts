/**
 * The roster's two activity columns.
 *
 * "Last Seen" reads as elapsed time ("4 days ago") and "Last Login" as an absolute stamp
 * ("29-08-2026 07:06 PM"), matching the reference. Both are null until an account first
 * signs in, and both render "Never" rather than a fabricated date — an account that has
 * never logged in is a real, useful thing for an admin to see.
 */

const pad = (n: number) => String(n).padStart(2, "0");

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "A few seconds ago" · "4 minutes ago" · "6 days ago". */
export function formatRelative(iso: string | null, now = Date.now()): string {
  if (!iso) return "Never";

  const elapsed = now - new Date(iso).getTime();
  // A clock skew between server and browser can make a fresh stamp look future-dated;
  // that is still "just now", not a negative duration.
  if (elapsed < MINUTE) return "A few seconds ago";
  if (elapsed < HOUR) return plural(Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return plural(Math.floor(elapsed / HOUR), "hour");
  return plural(Math.floor(elapsed / DAY), "day");
}

function plural(value: number, unit: string): string {
  return `${value} ${unit}${value === 1 ? "" : "s"} ago`;
}

/** "29-08-2026 07:06 PM" — the reference's two-line stamp, as one string. */
export function formatLastLogin(iso: string | null): string {
  if (!iso) return "Never";

  const date = new Date(iso);
  let hour = date.getHours();
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()} ${pad(hour)}:${pad(date.getMinutes())} ${meridiem}`;
}
