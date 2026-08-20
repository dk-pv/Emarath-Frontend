import { cn } from "@/lib/cn";

type ResponsiveTableContainerProps = {
  children: React.ReactNode;
  /**
   * Names the scroll region and makes it keyboard reachable. Table cells are not
   * focusable, so without this a keyboard user cannot reach the sideways scroll
   * (WCAG 2.1.1) — pass it whenever the table can overflow.
   */
  label?: string;
  className?: string;
};

/**
 * `min-w-0` is load-bearing: a flex or grid item defaults to `min-width: auto`, which
 * sizes it to the table's intrinsic width and scrolls the whole page instead of this box.
 *
 * `overflow-auto` (not just `-x`) makes this the table body's scroll region: when a
 * caller gives it a bounded height (TablePageLayout's `flex-1 min-h-0`), the rows scroll
 * inside it — below the sticky header, above the pinned pagination — the way Workpex's
 * list does. Where the height is unbounded (a page that grows), no vertical scrollbar
 * appears, so direct callers are unaffected.
 */
export function ResponsiveTableContainer({
  children,
  label,
  className,
}: ResponsiveTableContainerProps) {
  return (
    <div
      role={label ? "region" : undefined}
      aria-label={label}
      tabIndex={label ? 0 : undefined}
      className={cn(
        "scrollbar-slim focus-ring w-full min-w-0 overflow-auto",
        className,
      )}
    >
      {children}
    </div>
  );
}
