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
