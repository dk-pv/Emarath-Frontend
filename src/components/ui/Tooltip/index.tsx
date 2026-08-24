"use client";

import { cloneElement, useId, useRef } from "react";
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

export type TooltipProps = {
  content: React.ReactNode;
  /** A single element: `aria-describedby` must land on the trigger itself, not a wrapper. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  placement?: TooltipPlacement;
  /** Suppresses the tooltip (e.g. while the trigger's own popover is open). */
  disabled?: boolean;
};

export function Tooltip({
  content,
  children,
  placement = "top",
  disabled = false,
}: TooltipProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { isOpen, open, close } = useDisclosure();
  const tooltipId = useId();

  useDismissable(root, isOpen, close);

  const show = isOpen && !disabled;

  return (
    <span
      ref={root}
      className="relative inline-flex"
      onMouseEnter={disabled ? undefined : open}
      onMouseLeave={close}
      onFocus={disabled ? undefined : open}
      onBlur={close}
    >
      {cloneElement(children, {
        "aria-describedby": show ? tooltipId : undefined,
      })}

      {show && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(PANEL_CLASS, PLACEMENT_CLASS[placement])}
        >
          {content}
          <span
            aria-hidden="true"
            className={cn(POINTER_BASE, POINTER_CLASS[placement])}
          />
        </span>
      )}
    </span>
  );
}
