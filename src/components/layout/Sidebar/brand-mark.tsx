/**
 * Emarath brand lockup, pinned at the measured inset (ink starts at x=18 in both
 * sidebar states; the collapsed rail shows the mark only).
 *
 * The real logo asset is not in this repo — see "Assets Required". Brand name and
 * logo are two of the three things allowed to differ from Workpex.
 */
export function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <span
      className="flex items-baseline text-[26px] leading-none font-semibold tracking-tight text-white select-none"
      aria-label="Emarath"
    >
      <span className="text-brand">E</span>
      <span className={collapsed ? "hidden" : "hidden lg:inline"}>marath</span>
    </span>
  );
}
