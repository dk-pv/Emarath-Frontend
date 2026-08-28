"use client";

import { useCallback, useEffect, useRef, type RefObject } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";

export type AnchoredLayerCloseReason =
  "escape" | "outside" | "scroll" | "resize";

export type AnchoredLayerProps = React.ComponentPropsWithoutRef<"div"> & {
  open: boolean;
  onClose: (reason: AnchoredLayerCloseReason) => void;
  /** The trigger the panel hangs off. */
  anchorRef: RefObject<HTMLElement | null>;
  /** Which edge of the trigger the panel lines up with. */
  align?: "start" | "end";
  /** Fixed panel width in px (lets an end-aligned panel clamp inside the viewport). */
  width?: number;
  /** The panel is at least this wide, and never narrower than its trigger. */
  minWidth?: number;
  /** Gap between trigger and panel, px. */
  offset?: number;
  ref?: React.Ref<HTMLDivElement>;
};

const PANEL_CLASS =
  "fixed z-[200] rounded-surface border border-hairline bg-surface shadow-lg";

/** Viewport padding an end-aligned panel keeps from the left edge. */
const EDGE_GUTTER = 8;

/**
 * A panel portalled to <body> and fixed at its trigger — the escape hatch for menus and
 * pickers that live inside scrolling or clipping containers (table cells, Kanban
 * columns), where the absolute `Dropdown`/`Popover` would be cropped.
 *
 * Opens downward, or upward when the trigger sits in the lower part of the viewport.
 * A fixed panel would drift from a scrolling trigger, so any scroll outside the panel,
 * a resize, Escape or an outside press closes it; the reason is reported so a caller
 * can, say, return focus on Escape. Position is written through the panel's ref
 * callback at mount — before paint, with no state round-trip.
 */
export function AnchoredLayer({
  open,
  onClose,
  anchorRef,
  align = "start",
  width,
  minWidth,
  offset = 4,
  className,
  children,
  ref,
  ...props
}: AnchoredLayerProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);

  const attach = useCallback(
    (node: HTMLDivElement | null) => {
      panelRef.current = node;
      if (typeof ref === "function") ref(node);
      else if (ref) ref.current = node;
      if (!node) return;
      const rect = anchorRef.current?.getBoundingClientRect();
      if (!rect) return;

      const openUp = rect.bottom > window.innerHeight * 0.6;
      node.style.top = openUp ? "" : `${rect.bottom + offset}px`;
      node.style.bottom = openUp
        ? `${window.innerHeight - rect.top + offset}px`
        : "";
      if (align === "end") {
        if (width === undefined) {
          node.style.right = `${window.innerWidth - rect.right}px`;
        } else {
          node.style.left = `${Math.max(EDGE_GUTTER, rect.right - width)}px`;
        }
      } else {
        node.style.left = `${rect.left}px`;
      }
      if (width !== undefined) node.style.width = `${width}px`;
      if (minWidth !== undefined) {
        node.style.minWidth = `${Math.max(rect.width, minWidth)}px`;
      }
    },
    [ref, anchorRef, align, width, minWidth, offset],
  );

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (anchorRef.current?.contains(target)) return;
      if (panelRef.current?.contains(target)) return;
      onClose("outside");
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose("escape");
    };
    // A scroll inside the panel (a long list) is fine; any other scroll moves the trigger.
    const onScroll = (event: Event) => {
      if (panelRef.current?.contains(event.target as Node)) return;
      onClose("scroll");
    };
    const onResize = () => onClose("resize");
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, onClose, anchorRef]);

  if (!open) return null;

  return createPortal(
    <div ref={attach} className={cn(PANEL_CLASS, className)} {...props}>
      {children}
    </div>,
    document.body,
  );
}
