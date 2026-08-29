"use client";

import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { useMounted } from "@/components/ui/Modal";
import { useAnchoredPosition } from "@/hooks/use-anchored-position";

export type PopoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
  /**
   * Renders the panel fixed in `<body>` instead of absolutely inside the trigger's box,
   * so an ancestor with `overflow-hidden` (a report's results Card, a Kanban column) can
   * no longer crop it. Same escape hatch `Tooltip` offers.
   */
  portal?: boolean;
  /** Overrides the trigger button's shape — a pill control wants `rounded-control`. */
  triggerClassName?: string;
};

const PANEL_CLASS =
  "absolute top-[calc(100%+8px)] z-50 rounded-surface border border-hairline bg-surface shadow-lg";

const PORTAL_PANEL_CLASS =
  "fixed z-50 overflow-y-auto scrollbar-slim rounded-surface border border-hairline bg-surface shadow-lg";

export function Popover({
  trigger,
  children,
  align = "start",
  className,
  portal = false,
  triggerClassName,
}: PopoverProps) {
  const root = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  const mounted = useMounted();
  const [anchor, setAnchor] = useState<React.CSSProperties | null>(null);

  useDismissable(root, isOpen, close);
  // A fixed panel would drift away from a scrolling trigger, so re-anchor on open and
  // close if the page moves underneath it.
  useAnchoredPosition({
    enabled: portal && isOpen,
    triggerRef,
    align,
    onPosition: setAnchor,
    onDetach: close,
  });

  const panel = (
    <div
      className={cn(
        portal ? PORTAL_PANEL_CLASS : PANEL_CLASS,
        !portal && (align === "end" ? "right-0" : "left-0"),
        className,
      )}
      style={portal ? (anchor ?? { visibility: "hidden" }) : undefined}
    >
      {children}
    </div>
  );

  return (
    <div ref={root} className="relative">
      <button
        ref={triggerRef}
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggle}
        className={cn("block focus-ring", triggerClassName ?? "rounded-full")}
      >
        {trigger}
      </button>

      {isOpen &&
        (portal ? mounted && createPortal(panel, document.body) : panel)}
    </div>
  );
}
