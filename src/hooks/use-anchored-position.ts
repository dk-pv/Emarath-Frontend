"use client";

import { useCallback, useLayoutEffect, type RefObject } from "react";

/** Gap between the trigger and the panel — the 8px the absolute panels already use. */
const TRIGGER_GAP = 8;
/** Breathing room kept between the panel and the viewport edge. */
const MARGIN = 8;
/** Below this a clamped panel is unusable, so it keeps this size and scrolls instead. */
const MIN_SIZE = 140;

export type AnchorAlign = "start" | "end";
/** Which way the panel grows from its trigger. */
export type AnchorSide = "top" | "bottom";

/** Just the parts of a DOMRect the placement needs, so the maths can be tested. */
export type AnchorRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

export type Viewport = { width: number; height: number };

/**
 * Where a fixed panel sits relative to its trigger, clamped to the viewport.
 *
 * Pure so the clamping is verifiable: escaping an ancestor's `overflow-hidden` with fixed
 * positioning only moves the problem if the panel is then free to run off the screen —
 * which is what cropped the Sales Agent list. The panel is therefore pinned to the trigger
 * AND bounded, given a `maxWidth`/`maxHeight` to scroll within rather than overflowing.
 */
export function anchoredStyle(
  rect: AnchorRect,
  align: AnchorAlign,
  viewport: Viewport,
  side: AnchorSide = "bottom",
): React.CSSProperties {
  // Opening upward pins the panel's BOTTOM edge above the trigger, so it grows towards
  // the top of the screen; the room it has is whatever sits above the trigger.
  const vertical: React.CSSProperties =
    side === "top"
      ? { bottom: Math.max(MARGIN, viewport.height - rect.top + TRIGGER_GAP) }
      : { top: rect.bottom + TRIGGER_GAP };
  const maxHeight =
    side === "top"
      ? Math.max(MIN_SIZE, rect.top - TRIGGER_GAP - MARGIN)
      : Math.max(
          MIN_SIZE,
          viewport.height - (rect.bottom + TRIGGER_GAP) - MARGIN,
        );
  /** The widest a panel may ever be: the viewport minus a margin either side. */
  const usable = Math.max(MIN_SIZE, viewport.width - MARGIN * 2);

  if (align === "end") {
    // Anchored by its right edge, so it grows leftwards from the trigger. That only works
    // while there is room to its left — a trigger near the left edge has none, which is
    // what cropped the agent names, so the panel flips and opens rightwards instead.
    const room = rect.right - MARGIN;
    if (room >= MIN_SIZE) {
      return {
        ...vertical,
        right: Math.max(MARGIN, viewport.width - rect.right),
        maxHeight,
        maxWidth: Math.min(room, usable),
      };
    }
    return { ...vertical, left: MARGIN, maxHeight, maxWidth: usable };
  }

  // Anchored by its left edge, growing rightwards — flipped for a trigger near the right.
  const room = viewport.width - rect.left - MARGIN;
  if (room >= MIN_SIZE) {
    return {
      ...vertical,
      left: Math.max(MARGIN, rect.left),
      maxHeight,
      maxWidth: Math.min(room, usable),
    };
  }
  return { ...vertical, right: MARGIN, maxHeight, maxWidth: usable };
}

/** True once the trigger has scrolled out of sight, where a pinned panel floats free. */
export function isOffscreen(rect: AnchorRect, viewport: Viewport): boolean {
  return rect.bottom < 0 || rect.top > viewport.height;
}

export type AnchoredPositionOptions = {
  enabled: boolean;
  triggerRef: RefObject<HTMLElement | null>;
  align: AnchorAlign;
  /** Defaults to "bottom" — existing callers are unchanged. */
  side?: AnchorSide;
  onPosition: (style: React.CSSProperties) => void;
  /** Called when the trigger has left the viewport, so the panel is no longer meaningful. */
  onDetach?: () => void;
};

/**
 * Keeps a `position: fixed` panel anchored to its trigger and inside the viewport.
 *
 * Re-anchors on scroll and resize (as the Leads filter builder does) rather than closing,
 * so scrolling the page does not dismiss a menu the user is still reading.
 */
export function useAnchoredPosition({
  enabled,
  triggerRef,
  align,
  side = "bottom",
  onPosition,
  onDetach,
}: AnchoredPositionOptions) {
  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const rect = trigger.getBoundingClientRect();
    const viewport = { width: window.innerWidth, height: window.innerHeight };

    if (isOffscreen(rect, viewport)) {
      onDetach?.();
      return;
    }
    onPosition(anchoredStyle(rect, align, viewport, side));
  }, [triggerRef, align, side, onPosition, onDetach]);

  useLayoutEffect(() => {
    if (!enabled) return;
    reposition();
    window.addEventListener("resize", reposition);
    // Capture phase: the scroll may happen in any ancestor, not just the window.
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [enabled, reposition]);
}
