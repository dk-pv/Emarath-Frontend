import { cn } from "@/lib/cn";

/**
 * Per-status colour coding for the Lead Status badge (LEAD-11.1).
 *
 * Workpex gives every status its own colour — a soft pill filled with a light
 * tint and labelled in a darker shade of the same hue (violet New, teal Initial
 * Contact, green WON, gold HOT). The pairings below are transcribed from
 * `ui-reference/`: the Leads list (`leads-list-default-…`, WON / New / NOT ANSWER /
 * DATE SHIPMENT / READY TO DISPATCH / NOT REACHEBLE) and the Kanban legend
 * (`kanban-board-default-legend-tooltip-converted.png`: New, Initial Contact,
 * SUPER HOT, HOT, Cold, Warm). Keyed on the lowercased status text.
 *
 * In Workpex these colours are user-configurable and belong to the status
 * reference table (FND-04.2 / LEAD-11.1 backend). Until that lands this map is the
 * single source; an unmapped status falls back to a neutral grey rather than being
 * guessed a colour.
 */
const STATUS_COLOR: Record<string, string> = {
  new: "bg-violet-100 text-violet-700",
  "initial contact": "bg-teal-100 text-teal-700",
  cold: "bg-emerald-100 text-emerald-700",
  warm: "bg-amber-100 text-amber-700",
  hot: "bg-orange-100 text-orange-700",
  "super hot": "bg-purple-100 text-purple-700",
  won: "bg-green-100 text-green-700",
  qualified: "bg-green-100 text-green-700",
  "not answer": "bg-cyan-100 text-cyan-700",
  "not reached": "bg-rose-100 text-rose-700",
  "not reacheble": "bg-rose-100 text-rose-700",
  "invalid number": "bg-red-100 text-red-700",
  "ready to dispatch": "bg-violet-100 text-violet-700",
  "date shipment": "bg-indigo-100 text-indigo-700",
};

/** Unknown/unconfigured statuses read as neutral, never a guessed hue. */
const NEUTRAL = "bg-canvas text-ink-muted";

/** Same pill geometry as Workpex — rounded-full, small, medium weight. */
const BADGE_CLASS =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function LeadStatusBadge({ status }: { status: string }) {
  const color = STATUS_COLOR[status.trim().toLowerCase()] ?? NEUTRAL;
  return <span className={cn(BADGE_CLASS, color)}>{status}</span>;
}
