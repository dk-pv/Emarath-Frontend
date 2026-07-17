"use client";

import { useRef } from "react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";

export type PopoverProps = {
  trigger: React.ReactNode;
  children: React.ReactNode;
  align?: "start" | "end";
  className?: string;
};

const PANEL_CLASS =
  "absolute top-[calc(100%+8px)] z-50 rounded-surface border border-hairline bg-surface shadow-lg";

export function Popover({
  trigger,
  children,
  align = "start",
  className,
}: PopoverProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();

  useDismissable(root, isOpen, close);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-haspopup="dialog"
        onClick={toggle}
        className="block rounded-full focus-ring"
      >
        {trigger}
      </button>

      {isOpen && (
        <div
          className={cn(
            PANEL_CLASS,
            align === "end" ? "right-0" : "left-0",
            className,
          )}
        >
          {children}
        </div>
      )}
    </div>
  );
}
