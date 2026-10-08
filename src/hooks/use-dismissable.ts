"use client";

import { useEffect, useRef, type RefObject } from "react";

/**
 * The overlays open right now, innermost last. Escape dismisses only the last one, so a
 * select or date picker open inside a drawer or modal closes on its own instead of taking
 * the drawer — and the form in it — down with it.
 */
const openOverlays: object[] = [];

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
  // Registered apart from the listeners, so a re-render (a new refs array, a new
  // onDismiss) never moves an overlay above one opened after it.
  const token = useRef<object | null>(null);
  useEffect(() => {
    if (!isOpen) return;
    const mine = {};
    token.current = mine;
    openOverlays.push(mine);
    return () => {
      openOverlays.splice(openOverlays.indexOf(mine), 1);
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const list = Array.isArray(refs) ? refs : [refs];
    const onKeyDown = (event: KeyboardEvent) => {
      const innermost = openOverlays[openOverlays.length - 1];
      if (event.key === "Escape" && innermost === token.current) onDismiss();
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
