/**
 * A stable colour per lead source, for the Lead Source Summary donut and its legend.
 *
 * **Derived from the source name, never from its position.** The reference's own
 * donut recolours itself between Created Date and Assigned Date — the same source is
 * orange in one and tan in the other — which makes the chart unreadable at a glance
 * and is the one place this deliberately departs from Workpex. Here a source keeps
 * its colour across both modes, every period, and every reload, because the colour is
 * a pure function of the name.
 *
 * Index-based palettes (the reports' `DONUT_PALETTE`) are correct for a single ranked
 * table, where row 1 is always the largest; they are wrong here, where the same source
 * moves rank between the two modes.
 *
 * Literal Tailwind classes, so the scanner emits them. `arc` is a text colour because
 * the donut strokes with `currentColor`; `swatch` fills the legend dot.
 */
export type SourceColor = { arc: string; swatch: string };

/**
 * Twelve hues drawn from the reference's own range — a dominant warm tone, magenta,
 * khaki, pale cyan, blues, teal and yellow — spaced so neighbours in the ring stay
 * distinguishable.
 */
const SOURCE_PALETTE: readonly SourceColor[] = [
  { arc: "text-orange-400", swatch: "bg-orange-400" },
  { arc: "text-fuchsia-700", swatch: "bg-fuchsia-700" },
  { arc: "text-stone-400", swatch: "bg-stone-400" },
  { arc: "text-cyan-200", swatch: "bg-cyan-200" },
  { arc: "text-blue-500", swatch: "bg-blue-500" },
  { arc: "text-cyan-400", swatch: "bg-cyan-400" },
  { arc: "text-indigo-500", swatch: "bg-indigo-500" },
  { arc: "text-yellow-500", swatch: "bg-yellow-500" },
  { arc: "text-emerald-400", swatch: "bg-emerald-400" },
  { arc: "text-rose-400", swatch: "bg-rose-400" },
  { arc: "text-violet-500", swatch: "bg-violet-500" },
  { arc: "text-teal-500", swatch: "bg-teal-500" },
] as const;

/**
 * FNV-1a over the source name. Any stable hash would do; this one is short, has no
 * dependency and spreads short ASCII labels well. `>>> 0` keeps it unsigned so the
 * modulo can never return a negative index.
 */
function hash(value: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    h ^= value.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * The colour for one source. Unknown and future sources are handled by construction —
 * there is no lookup table to miss — and any number of sources is safe.
 *
 * With more sources than hues two of them share a colour. That is the deliberate cost
 * of position-independence: resolving collisions would mean consulting the other
 * sources present, and the set differs between Created and Assigned, which is exactly
 * the instability this exists to prevent.
 */
export function sourceColor(source: string): SourceColor {
  return SOURCE_PALETTE[hash(source) % SOURCE_PALETTE.length];
}
