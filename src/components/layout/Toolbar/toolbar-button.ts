/**
 * The shared Workpex toolbar-control style.
 *
 * Measured from `leads-list-default-scroll-left-…png`: every toolbar control except
 * the filled "New Lead" button is borderless — an ink icon and label with no border
 * or fill, a faint canvas wash on hover. Controls sit ~24px apart (ink-to-ink); the
 * `px-2` here plus the toolbar cluster's own `gap-2` reproduce that spacing, and the
 * 18px icons / 14px text and ~30px control height match the reference.
 */
export const TOOLBAR_BUTTON_CLASS =
  "focus-ring inline-flex h-control-sm items-center gap-1.5 rounded-control px-2 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas";
