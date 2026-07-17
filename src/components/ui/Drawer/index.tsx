"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDismissable } from "@/hooks/use-dismissable";
import { useDialogA11y, useMounted } from "@/components/ui/Modal";

const CLOSE_CLASS =
  "-mt-1 -mr-1 inline-flex size-control-sm shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring";

export type DrawerProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  /** Tailwind width utility for the panel, e.g. `max-w-lg`. Raw lengths are not tokenised. */
  width?: string;
};

type DrawerPanelProps = Omit<DrawerProps, "open">;

/**
 * Split out of `Drawer` so the slide-in state is created by the mount itself: it starts
 * off-screen every time the panel appears, with no reset to sequence on close.
 */
function DrawerPanel({
  onClose,
  title,
  children,
  footer,
  width = "max-w-md",
}: DrawerPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  // The ref is the panel, so a backdrop press reads as "outside" and closes.
  useDismissable(panel, true, onClose);
  useDialogA11y(panel, true);

  // The panel must commit off-screen before the class flips, or there is nothing to ease.
  const [slidIn, setSlidIn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSlidIn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 bg-ink/50 transition-opacity duration-(--duration-shell) ease-shell",
          slidIn ? "opacity-100" : "opacity-0",
        )}
      />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex h-full w-full flex-col border-l border-hairline bg-surface shadow-xl transition-transform duration-(--duration-shell) ease-shell focus:outline-none",
          width,
          slidIn ? "translate-x-0" : "translate-x-full",
        )}
      >
        <header className="flex items-start justify-between gap-3 border-b border-hairline p-5">
          <h2 id={titleId} className="text-lg font-semibold text-ink">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className={CLOSE_CLASS}
          >
            <IconX aria-hidden="true" stroke={2} className="size-4" />
          </button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5 text-sm text-ink scrollbar-slim">
          {children}
        </div>

        {footer && (
          <footer className="flex items-center justify-end gap-3 border-t border-hairline p-5">
            {footer}
          </footer>
        )}
      </div>
    </div>
  );
}

export function Drawer({ open, ...panelProps }: DrawerProps) {
  const mounted = useMounted();

  if (!open || !mounted) return null;

  return createPortal(<DrawerPanel {...panelProps} />, document.body);
}
