/**
 * Tag pill colours (the Converted Leads / Leads list reference: BDE RISK rose, QC VERIFIED
 * violet, DISPATCHED green, QC 2 VERIFIED blue).
 *
 * A `Tag` carries no colour column, so the hue is derived from the tag's NAME with a stable
 * hash — the same tag renders the same colour on every screen, every session, for every
 * user, but which hue a given name lands on is deterministic-arbitrary, not configured.
 * Exact per-tag hues (Workpex stores its own) would need a `color` column on `Tag`.
 * Classes are literal so Tailwind emits them (CLAUDE.md §7).
 */

/** Colour-only classes (border + fill + text), for overriding a Chip's tone. */
const TAG_TONES = [
  "border-rose-200 bg-rose-100 text-rose-900",
  "border-violet-200 bg-violet-100 text-violet-900",
  "border-lime-300 bg-lime-100 text-lime-900",
  "border-blue-300 bg-blue-100 text-blue-900",
  "border-amber-300 bg-amber-100 text-amber-900",
  "border-cyan-300 bg-cyan-100 text-cyan-900",
] as const;

const PILL_BASE =
  "inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-xs font-medium";

/** sdbm — tiny and stable; picked over djb2/fnv1a for the evenest spread on the live catalogue. */
function hash(name: string): number {
  let value = 0;
  for (let index = 0; index < name.length; index += 1) {
    value = (name.charCodeAt(index) + (value << 6) + (value << 16) - value) | 0;
  }
  return value >>> 0;
}

/** The colour-only classes for a tag name (e.g. to recolour a Chip). */
export function tagToneClass(name: string): string {
  return TAG_TONES[hash(name) % TAG_TONES.length];
}

/** The complete pill for a tag name — shape plus its hashed hue. */
export function tagPillClass(name: string): string {
  return `${PILL_BASE} ${tagToneClass(name)}`;
}
