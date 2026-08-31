"use client";

import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

/** Breathing room between the panel and the content column / viewport edges. */
const GAP = 8;
/** Trigger bottom to panel top — 11px in every Workpex popover reference. */
const TRIGGER_GAP = 11;

export type AnchoredPanelPosition = {
  top: number;
  left: number;
  width: number;
};

/**
 * A Workpex toolbar panel's placement and open state: portaled, `position: fixed`,
 * centred on its trigger and clamped inside the main content column (`[data-app-main]`)
 * and the viewport, so it never renders under the sidebar whether the rail is expanded
 * or collapsed. Dismisses on an outside press or Escape, checking both the trigger and
 * the (portaled) panel.
 *
 * Lifted out of the Leads filter builder so the report date panel is positioned by the
 * same code, not a second copy that could drift.
 */
export function useAnchoredPanel(maxWidth: number) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<AnchoredPanelPosition | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const reposition = useCallback(() => {
    const trigger = triggerRef.current;
    if (!trigger) return;
    const t = trigger.getBoundingClientRect();
    const main = document
      .querySelector("[data-app-main]")
      ?.getBoundingClientRect();
    const mainLeft = main ? main.left : 0;
    const vw = window.innerWidth;
    const available = vw - mainLeft - GAP * 2;
    const width = Math.max(280, Math.min(maxWidth, available));
    // Centred on the trigger, which is what Workpex does: in the references the panel's
    // centre sits within half a pixel of the chip's centre. The clamps then keep it inside
    // the content column and the viewport, so a trigger near either edge slides the panel
    // instead of overflowing.
    let left = t.left + t.width / 2 - width / 2;
    left = Math.min(left, vw - GAP - width);
    left = Math.max(left, mainLeft + GAP);
    setPos({ top: t.bottom + TRIGGER_GAP, left, width });
  }, [maxWidth]);

  useLayoutEffect(() => {
    if (!open) return;
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    return () => {
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        !triggerRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return { open, setOpen, pos, triggerRef, panelRef };
}
