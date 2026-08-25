"use client";

import { cloneElement, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

export type TooltipPlacement = "top" | "bottom" | "left" | "right";

const PANEL_CLASS =
  "pointer-events-none absolute z-50 w-max max-w-56 rounded-control bg-sidebar px-2.5 py-1.5 text-xs text-white shadow-lg";

const PLACEMENT_CLASS: Record<TooltipPlacement, string> = {
  top: "bottom-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  bottom: "top-[calc(100%+8px)] left-1/2 -translate-x-1/2",
  left: "top-1/2 right-[calc(100%+8px)] -translate-y-1/2",
  right: "top-1/2 left-[calc(100%+8px)] -translate-y-1/2",
};

/**
 * The pointer — a rotated square centred on the panel edge nearest the target, so
 * its outer corner reads as Workpex's little triangle. Same `bg-sidebar` as the body,
 * so the two merge into one shape.
 */
const POINTER_BASE = "absolute size-2 rotate-45 bg-sidebar";
const POINTER_CLASS: Record<TooltipPlacement, string> = {
  top: "top-full left-1/2 -translate-x-1/2 -translate-y-1/2",
  bottom: "bottom-full left-1/2 -translate-x-1/2 translate-y-1/2",
  left: "left-full top-1/2 -translate-x-1/2 -translate-y-1/2",
  right: "right-full top-1/2 translate-x-1/2 -translate-y-1/2",
};

/**
 * Portalled variant: fixed-positioned in <body>, escaping any ancestor overflow clip
 * (e.g. a Kanban column's scrolling body would crop an absolute tooltip on its first
 * card — the same clip StageLegend escapes the same way). Coordinates are captured
 * on open; the tooltip is transient, so it is not re-anchored on scroll.
 */
const PORTAL_PANEL_CLASS =
  "pointer-events-none fixed z-[200] w-max max-w-56 rounded-control bg-sidebar px-2.5 py-1.5 text-xs text-white shadow-lg";

const PORTAL_TRANSFORM: Record<TooltipPlacement, string> = {
  top: "-translate-x-1/2 -translate-y-full",
  bottom: "-translate-x-1/2",
  left: "-translate-x-full -translate-y-1/2",
  right: "-translate-y-1/2",
};

/** The 8px trigger-to-panel gap, as the absolute placements use. */
function portalAnchor(rect: DOMRect, placement: TooltipPlacement) {
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  switch (placement) {
    case "top":
      return { left: cx, top: rect.top - 8 };
    case "bottom":
      return { left: cx, top: rect.bottom + 8 };
    case "left":
      return { left: rect.left - 8, top: cy };
    case "right":
      return { left: rect.right + 8, top: cy };
  }
}

export type TooltipProps = {
  content: React.ReactNode;
  /** A single element: `aria-describedby` must land on the trigger itself, not a wrapper. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  placement?: TooltipPlacement;
  /** Suppresses the tooltip (e.g. while the trigger's own popover is open). */
  disabled?: boolean;
  /** Renders the panel fixed in <body>, escaping ancestor overflow clipping. */
  portal?: boolean;
};

export function Tooltip({
  content,
  children,
  placement = "top",
  disabled = false,
  portal = false,
}: TooltipProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { isOpen, open, close } = useDisclosure();
  const [anchor, setAnchor] = useState<{ left: number; top: number } | null>(
    null,
  );
  const tooltipId = useId();

  useDismissable(root, isOpen, close);

  const show = isOpen && !disabled;

  const openTip = () => {
    if (portal) {
      const rect = root.current?.getBoundingClientRect();
      setAnchor(rect ? portalAnchor(rect, placement) : null);
    }
    open();
  };

  const panel = (
    <span
      id={tooltipId}
      role="tooltip"
      className={cn(
        portal
          ? cn(PORTAL_PANEL_CLASS, PORTAL_TRANSFORM[placement])
          : cn(PANEL_CLASS, PLACEMENT_CLASS[placement]),
      )}
      style={portal && anchor ? anchor : undefined}
    >
      {content}
      <span
        aria-hidden="true"
        className={cn(POINTER_BASE, POINTER_CLASS[placement])}
      />
    </span>
  );

  return (
    <span
      ref={root}
      className="relative inline-flex"
      onMouseEnter={disabled ? undefined : openTip}
      onMouseLeave={close}
      onFocus={disabled ? undefined : openTip}
      onBlur={close}
    >
      {cloneElement(children, {
        "aria-describedby": show ? tooltipId : undefined,
      })}

      {show &&
        (portal
          ? anchor !== null && createPortal(panel, document.body)
          : panel)}
    </span>
  );
}
