/**
 * Emarath brand lockup for the sidebar top.
 *
 * The app has no logo asset, so the mark is built in place: a rounded brand-green tile carrying
 * a geometric "E" monogram knocked out in the sidebar colour, next to the "Emarath" wordmark.
 * Brand name and logo are two of the three things allowed to differ from Workpex (CLAUDE.md).
 *
 * Expanded shows the tile + wordmark; collapsed shows the tile alone — an intentional compact
 * brand mark, never a bare letter. Only the wordmark fades between states (like the nav labels),
 * so the tile never moves and the rail never reflows. The tile's centre sits on the same column
 * as the nav icons below it (`--spacing-brand-inset` + tile centre = nav icon centre).
 */
export function BrandMark({ collapsed }: { collapsed: boolean }) {
  return (
    <span className="flex items-center gap-3 select-none" aria-label="Emarath">
      <svg
        viewBox="0 0 36 36"
        className="size-9 shrink-0"
        role="img"
        aria-hidden="true"
      >
        <rect width="36" height="36" rx="9" className="fill-brand" />
        {/* Geometric "E": spine + three bars, knocked out in the sidebar colour. */}
        <g className="fill-sidebar">
          <rect x="12" y="10.5" width="3.4" height="15" rx="1" />
          <rect x="12" y="10.5" width="12" height="3.4" rx="1" />
          <rect x="12" y="16.3" width="9.2" height="3.4" rx="1" />
          <rect x="12" y="22.1" width="12" height="3.4" rx="1" />
        </g>
      </svg>

      <span
        className={`text-[22px] font-semibold tracking-tight whitespace-nowrap text-white transition-opacity duration-(--duration-shell) ease-shell ${
          collapsed ? "opacity-0" : "opacity-0 lg:opacity-100"
        }`}
      >
        Emarath
      </span>
    </span>
  );
}
