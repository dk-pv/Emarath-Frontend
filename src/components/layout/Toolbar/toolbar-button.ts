/**
 * The shared Workpex toolbar-control style.
 *
 * Measured from `leads-list-default-scroll-left-…png`: every toolbar control except
 * the filled "New Lead" button is borderless — an ink icon and label with no border
 * or fill, a faint canvas wash on hover. At the chosen density (ADR-0076) a control is
 * the `control-sm` height, its label 13px in the reference's #505050 rather than the
 * page-title ink, and controls sit ~16px apart ink-to-ink — the `px-1.5` here plus the
 * cluster's `gap-1`. Poppins runs wider than the reference face, which is why the label
 * is one step below the table's 14px: at 14px the nine controls overran the reference
 * cluster by a fifth.
 */
export const TOOLBAR_BUTTON_CLASS =
  "focus-ring inline-flex h-control-sm items-center gap-1 rounded-control px-1.5 text-[13px] text-ink-soft transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas";
