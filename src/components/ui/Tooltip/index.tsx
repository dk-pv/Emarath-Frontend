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

export type TooltipProps = {
  content: React.ReactNode;
  /** A single element: `aria-describedby` must land on the trigger itself, not a wrapper. */
  children: React.ReactElement<{ "aria-describedby"?: string }>;
  placement?: TooltipPlacement;
};

export function Tooltip({
  content,
  children,
  placement = "top",
}: TooltipProps) {
  const root = useRef<HTMLSpanElement>(null);
  const { isOpen, open, close } = useDisclosure();
  const tooltipId = useId();

  useDismissable(root, isOpen, close);

  return (
    <span
      ref={root}
      className="relative inline-flex"
      onMouseEnter={open}
      onMouseLeave={close}
      onFocus={open}
      onBlur={close}
    >
      {cloneElement(children, {
        "aria-describedby": isOpen ? tooltipId : undefined,
      })}

      {isOpen && (
        <span
          id={tooltipId}
          role="tooltip"
          className={cn(PANEL_CLASS, PLACEMENT_CLASS[placement])}
        >
          {content}
        </span>
      )}
    </span>
  );
}
