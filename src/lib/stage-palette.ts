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

const PALETTE: Record<string, StageColorClasses> = {
  violet: {
    badge: "bg-violet-400 text-violet-950",
    swatch: "bg-violet-500",
    tint: "bg-violet-50 border-violet-200",
    cardBorder: "border-violet-300",
  },
  cyan: {
    badge: "bg-cyan-300 text-cyan-900",
    swatch: "bg-cyan-500",
    tint: "bg-cyan-50 border-cyan-200",
    cardBorder: "border-cyan-300",
  },
  slate: {
    badge: "bg-slate-600 text-white",
    swatch: "bg-slate-600",
    tint: "bg-slate-100 border-slate-300",
    cardBorder: "border-slate-400",
  },
  amber: {
    badge: "bg-amber-300 text-amber-900",
    swatch: "bg-amber-500",
    tint: "bg-amber-50 border-amber-200",
    cardBorder: "border-amber-300",
  },
  sky: {
    badge: "bg-sky-300 text-sky-900",
    swatch: "bg-sky-500",
    tint: "bg-sky-50 border-sky-200",
    cardBorder: "border-sky-300",
  },
  yellow: {
    badge: "bg-yellow-300 text-yellow-900",
    swatch: "bg-yellow-400",
    tint: "bg-yellow-50 border-yellow-200",
    cardBorder: "border-yellow-300",
  },
  purple: {
    badge: "bg-purple-600 text-white",
    swatch: "bg-purple-600",
    tint: "bg-purple-50 border-purple-200",
    cardBorder: "border-purple-300",
  },
  teal: {
    badge: "bg-teal-300 text-teal-900",
    swatch: "bg-teal-400",
    tint: "bg-teal-50 border-teal-200",
    cardBorder: "border-teal-300",
  },
  rose: {
    badge: "bg-rose-300 text-rose-900",
    swatch: "bg-rose-400",
    tint: "bg-rose-50 border-rose-200",
    cardBorder: "border-rose-300",
  },
  blue: {
    badge: "bg-blue-600 text-white",
    swatch: "bg-blue-600",
    tint: "bg-blue-50 border-blue-200",
    cardBorder: "border-blue-300",
  },
  red: {
    badge: "bg-red-300 text-red-900",
    swatch: "bg-red-500",
    tint: "bg-red-50 border-red-200",
    cardBorder: "border-red-300",
  },
  gray: {
    badge: "bg-gray-200 text-gray-700",
    swatch: "bg-gray-400",
    tint: "bg-gray-100 border-gray-300",
    cardBorder: "border-gray-300",
  },
  lime: {
    badge: "bg-lime-500 text-lime-950",
    swatch: "bg-lime-500",
    tint: "bg-lime-50 border-lime-200",
    cardBorder: "border-lime-300",
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
export function stageColorClasses(colorKey: string | null | undefined): StageColorClasses {
  if (!colorKey) return NEUTRAL;
  return PALETTE[colorKey] ?? NEUTRAL;
}

/** The palette keys a stage may take — the choices the recolour picker offers (KAN-05.2). */
export const STAGE_COLOR_KEYS: readonly string[] = Object.keys(PALETTE);
