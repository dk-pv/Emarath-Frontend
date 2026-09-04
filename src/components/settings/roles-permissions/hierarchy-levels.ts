/**
 * Hierarchy-level styling, from the Workpex Roles & Permissions screenshots and the
 * "Hierarchy Levels" legend beneath the tree: level 1 purple, 2 blue, 3 yellow, 4 orange,
 * 5 green, 6 pink.
 *
 * Colour is a function of depth alone — never of the role's name or id — so the same
 * level always reads the same way down the tree, which is what makes the legend true.
 *
 * Literal Tailwind class strings so the compiler emits them (CLAUDE.md §7: no inline hex;
 * these are theme palette values, not raw colours).
 */
export const MAX_HIERARCHY_LEVEL = 6;

export interface LevelStyle {
  /** The role row's pill: border plus its tinted fill. */
  row: string;
  /** The legend's colour chip for this level. */
  swatch: string;
}

const LEVEL_STYLES: LevelStyle[] = [
  { row: "border-purple-300 bg-purple-50", swatch: "border-purple-300 bg-purple-50" },
  { row: "border-blue-300 bg-blue-50", swatch: "border-blue-300 bg-blue-50" },
  { row: "border-yellow-300 bg-yellow-50", swatch: "border-yellow-300 bg-yellow-50" },
  { row: "border-orange-300 bg-orange-50", swatch: "border-orange-300 bg-orange-50" },
  { row: "border-green-300 bg-green-50", swatch: "border-green-300 bg-green-50" },
  { row: "border-pink-300 bg-pink-50", swatch: "border-pink-300 bg-pink-50" },
];

/**
 * The band for a 1-based depth. Depths past the last defined level reuse it rather than
 * rendering an unstyled row — the server caps creation at `MAX_HIERARCHY_LEVEL`, so this
 * only ever guards against data that predates the cap.
 */
export function levelStyle(level: number): LevelStyle {
  const index = Math.min(Math.max(level, 1), LEVEL_STYLES.length) - 1;
  return LEVEL_STYLES[index];
}

/** The legend rows: "Level - 1" … "Level - 6". */
export const HIERARCHY_LEGEND = LEVEL_STYLES.map((style, index) => ({
  label: `Level - ${index + 1}`,
  swatch: style.swatch,
}));
