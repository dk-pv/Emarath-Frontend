"use client";

import { useEffect, type RefObject } from "react";

/**
 * Closes an overlay on Escape or a pointer press outside it.
 *
 * Accepts one ref or several: an overlay whose panel is PORTALLED to `document.body` is not
 * inside its trigger's wrapper, so the wrapper ref alone would treat every press inside the
 * panel as "outside" and dismiss it before the press's click can land — pass the panel's ref
 * alongside the trigger's and both count as inside.
 */
export function useDismissable(
  refs:
    | RefObject<HTMLElement | null>
    | ReadonlyArray<RefObject<HTMLElement | null>>,
  isOpen: boolean,
  onDismiss: () => void,
) {
  useEffect(() => {
    if (!isOpen) return;

    const list = Array.isArray(refs) ? refs : [refs];
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onDismiss();
    };
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (!list.some((ref) => ref.current?.contains(target))) onDismiss();
    };

    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [refs, isOpen, onDismiss]);
}
