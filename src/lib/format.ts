/**
 * Shared display formatters (FND-04.1). Every list, card and detail view renders dates
 * the way Workpex does — `16-07-2026, 11:39 AM` — and money as AED with the dirham
 * sign. One implementation means no module can drift from the others.
 */

const pad2 = (n: number) => String(n).padStart(2, "0");

/** `dd-mm-yyyy`. An unparseable value is returned as-is so a bad custom-field entry still shows. */
export function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return `${pad2(date.getDate())}-${pad2(date.getMonth() + 1)}-${date.getFullYear()}`;
}

export type TimeFormatOptions = {
  /** Include seconds — `11:39:05 AM` (Documents, Call log, GPS). */
  seconds?: boolean;
  /** Two-digit hour — `04:25 PM` rather than `4:25 PM` (the Next Follow-up card). */
  padHour?: boolean;
};

/** `h:mm AM`, in the browser's timezone. */
export function formatTime(
  value: string,
  { seconds = false, padHour = false }: TimeFormatOptions = {},
): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleTimeString("en-US", {
    hour: padHour ? "2-digit" : "numeric",
    minute: "2-digit",
    ...(seconds ? { second: "2-digit" as const } : {}),
    hour12: true,
  });
}

/** `dd-mm-yyyy, h:mm AM` — the Workpex date-time. Client-only, so no SSR skew. */
export function formatDateTime(
  value: string,
  options?: TimeFormatOptions,
): string {
  if (Number.isNaN(new Date(value).getTime())) return value;
  return `${formatDate(value)}, ${formatTime(value, options)}`;
}

const AED_SIGN = "د.إ";
const AED_2DP = new Intl.NumberFormat("en-AE", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});
const AED_0DP = new Intl.NumberFormat("en-AE", { maximumFractionDigits: 0 });

/**
 * `1,234.50 د.إ`. Amounts travel as decimal strings from the API; `null` (no value) and
 * anything unparseable render as the muted dash the tables use for absent data.
 */
export function formatAED(
  value: string | number | null,
  { digits = 2 }: { digits?: 0 | 2 } = {},
): string {
  if (value === null) return "—";
  const amount = Number(value);
  if (Number.isNaN(amount)) return "—";
  return `${(digits === 0 ? AED_0DP : AED_2DP).format(amount)} ${AED_SIGN}`;
}

/** `1.4K د.إ` / `16K` / `2.5M`, whole numbers below a thousand — the Kanban column totals. */
export function formatAEDCompact(value: string | number): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return `0 ${AED_SIGN}`;
  if (n >= 1_000_000) return `${abbreviate(n, 1_000_000, "M")} ${AED_SIGN}`;
  if (n >= 1000) return `${abbreviate(n, 1000, "K")} ${AED_SIGN}`;
  return `${AED_0DP.format(n)} ${AED_SIGN}`;
}

function abbreviate(value: number, divisor: number, suffix: string): string {
  const scaled = value / divisor;
  return `${scaled >= 10 ? Math.round(scaled) : Number(scaled.toFixed(1))}${suffix}`;
}

/** First + last initial, upper-cased — "Sales Agent One" → "SO" — for avatar placeholders. */
export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1][0] ?? "") : "";
  return (first + last).toUpperCase();
}

/**
 * A coarse "18 hours ago" for the Lead Detail panel's Last Updated line. Deliberately
 * coarse: the exact instant is already shown beside it as the created timestamp, and a
 * ticking precise value would only churn. Client-only, so no SSR/locale skew.
 */
export function formatRelativeTime(
  value: string,
  now: number = Date.now(),
): string {
  const then = new Date(value).getTime();
  if (Number.isNaN(then)) return "—";
  const seconds = Math.round((now - then) / 1000);
  if (seconds < 0) return "just now";
  const units: [limit: number, size: number, name: string][] = [
    [60, 1, "second"],
    [3600, 60, "minute"],
    [86400, 3600, "hour"],
    [2592000, 86400, "day"],
    [31536000, 2592000, "month"],
    [Infinity, 31536000, "year"],
  ];
  for (const [limit, size, name] of units) {
    if (seconds < limit) {
      const amount = Math.floor(seconds / size);
      if (amount <= 0) return "just now";
      return `${amount} ${name}${amount === 1 ? "" : "s"} ago`;
    }
  }
  return "—";
}

/**
 * A compact whole-unit duration between two instants — "Same day", "3 hours", "12 days" —
 * for metric columns like the Converted report's Conversion Time. Negative or invalid
 * spans render as an em dash by the caller (this returns null for them).
 */
export function formatDuration(fromIso: string, toIso: string): string | null {
  const ms = new Date(toIso).getTime() - new Date(fromIso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return null;
  const hours = Math.floor(ms / 3_600_000);
  if (hours < 1) return "Same day";
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"}`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"}`;
}
