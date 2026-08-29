/**
 * Stage colour palette (KAN-05.2).
 *
 * Maps a stage's colour KEY — the framework-agnostic value the Stage API stores
 * (`violet`, `amber`, …, KAN-05.1) — to the Tailwind classes each view needs. This
 * is the CSS rendering layer, so it stays in the frontend (classes must be literal
 * for Tailwind to emit them, CLAUDE.md §7); the stage CATALOGUE (which stages exist,
 * their names, order and colour) now comes from the API, not from here. Colours are
 * the same design tokens the old per-stage config used, re-keyed by hue.
 *
 * A hue with a solid badge in Workpex (slate/purple/blue/lime) fills its badge and
 * takes light text; the rest use a light fill with dark text. Because a stage now
 * carries a single colour, two stages sharing a hue render identically (e.g. WON and
 * Converted are both `lime`) — the correct behaviour for a user-configurable palette.
 */

/** The four class sets a stage colour drives across the list and board. */
export interface StageColorClasses {
  /** List status pill (LEAD-11.1). */
  badge: string;
  /** Solid square/dot — status dropdown swatch and board dot. */
  swatch: string;
  /** Board column header fill + border (KAN-02.2). */
  tint: string;
  /** Board card border (KAN-03.1). */
  cardBorder: string;
}

/**
 * `tint` and `cardBorder` are pinned to the shade nearest the colour sampled from the
 * Workpex board captures in `ui-reference/Kanban/`. The board's card borders and header
 * fills there are noticeably saturated; the 50/200 pair this table used before read as
 * near-grey. Sampled card-border / header-fill, and the shade chosen for each:
 *
 *   violet  New                #b78ee6 / #e5d9f3   400 / 200   (kanban-board-default…)
 *   cyan    Initial Contact    #21d5f5 / #b7eef8   400 / 200   (kanban-board-default…)
 *   slate   SUPER HOT          #3c485a / #cacdd1   700 / 300   (kanban-board-default…)
 *   amber   HOT                #f5b726 / #f8e5b9   300 / 100   (kanban-board-default…)
 *   sky     Cold               #73b4e6 / #d0e4f3   300 / 100   (kanban-board-default…)
 *   yellow  Warm               #fadb6b / #f9f0ce   200 / 100   (kanban-board-default…)
 *   blue    Follow-Up          #0a3be2 / #bdc9f4   700 / 200   (kanban-sort-dropdown…)
 *   red     Cancel             #ed5867 / #f6c8cc   400 / 200   (kanban-sort-dropdown…)
 *   gray    COMPLAINT          #a4a4a4 / #dfdfdf   400 / 200   (kanban-sort-dropdown…)
 *   teal    NOT ANSWER         #0eefe9 / #b1f6f4   400 / 100   (kanban-quick-filter…)
 *   rose    NOT REACHEBLE      #ce889f / #ecd7de   300 / 100   (kanban-quick-filter…)
 *
 * The header border sits one shade above its fill: Workpex draws a visibly darker edge,
 * and matching fill and border to the same shade would erase it.
 *
 * `purple` and `lime` are UNVERIFIED — no reference capture shows a DATE SHIPMENT,
 * QC NOT APPROVED, WON or Converted column, so they follow the pattern the eleven
 * sampled hues share rather than a measurement. They need a screenshot to confirm.
 *
 * `badge` and `swatch` are deliberately untouched: the Leads status pill and dropdown
 * and three Reports charts render from them, and none of those is in this task's scope.
 */
const PALETTE: Record<string, StageColorClasses> = {
  violet: {
    badge: "bg-violet-400 text-violet-950",
    swatch: "bg-violet-500",
    tint: "bg-violet-200 border-violet-300",
    cardBorder: "border-violet-400",
  },
  cyan: {
    badge: "bg-cyan-300 text-cyan-900",
    swatch: "bg-cyan-500",
    tint: "bg-cyan-200 border-cyan-300",
    cardBorder: "border-cyan-400",
  },
  slate: {
    badge: "bg-slate-600 text-white",
    swatch: "bg-slate-600",
    tint: "bg-slate-300 border-slate-400",
    cardBorder: "border-slate-700",
  },
  amber: {
    badge: "bg-amber-300 text-amber-900",
    swatch: "bg-amber-500",
    tint: "bg-amber-100 border-amber-200",
    cardBorder: "border-amber-300",
  },
  sky: {
    badge: "bg-sky-300 text-sky-900",
    swatch: "bg-sky-500",
    tint: "bg-sky-100 border-sky-200",
    cardBorder: "border-sky-300",
  },
  yellow: {
    badge: "bg-yellow-300 text-yellow-900",
    swatch: "bg-yellow-400",
    tint: "bg-yellow-100 border-yellow-200",
    cardBorder: "border-yellow-200",
  },
  purple: {
    badge: "bg-purple-600 text-white",
    swatch: "bg-purple-600",
    tint: "bg-purple-100 border-purple-200",
    cardBorder: "border-purple-400",
  },
  teal: {
    badge: "bg-teal-300 text-teal-900",
    swatch: "bg-teal-400",
    tint: "bg-teal-100 border-teal-200",
    cardBorder: "border-teal-400",
  },
  rose: {
    badge: "bg-rose-300 text-rose-900",
    swatch: "bg-rose-400",
    tint: "bg-rose-100 border-rose-200",
    cardBorder: "border-rose-300",
  },
  blue: {
    badge: "bg-blue-600 text-white",
    swatch: "bg-blue-600",
    tint: "bg-blue-200 border-blue-300",
    cardBorder: "border-blue-700",
  },
  red: {
    badge: "bg-red-300 text-red-900",
    swatch: "bg-red-500",
    tint: "bg-red-200 border-red-300",
    cardBorder: "border-red-400",
  },
  gray: {
    badge: "bg-gray-200 text-gray-700",
    swatch: "bg-gray-400",
    tint: "bg-gray-200 border-gray-300",
    cardBorder: "border-gray-400",
  },
  lime: {
    badge: "bg-lime-500 text-lime-950",
    swatch: "bg-lime-500",
    tint: "bg-lime-100 border-lime-200",
    cardBorder: "border-lime-400",
  },
};

/** Unknown or unset colour: a neutral treatment, never a guessed hue. */
const NEUTRAL: StageColorClasses = {
  badge: "bg-canvas text-ink-muted",
  swatch: "bg-slate-300",
  tint: "bg-canvas border-hairline",
  cardBorder: "border-hairline",
};

/** The class sets for a colour key; neutral when the key is unknown or absent. */
export function stageColorClasses(
  colorKey: string | null | undefined,
): StageColorClasses {
  if (!colorKey) return NEUTRAL;
  return PALETTE[colorKey] ?? NEUTRAL;
}

/** The palette keys a stage may take — the choices the recolour picker offers (KAN-05.2). */
export const STAGE_COLOR_KEYS: readonly string[] = Object.keys(PALETTE);
