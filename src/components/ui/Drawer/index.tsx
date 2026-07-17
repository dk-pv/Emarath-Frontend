"use client";

import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDismissable } from "@/hooks/use-dismissable";
import { useDialogA11y, useMounted } from "@/components/ui/Modal";

/**
 * Workpex hangs the close control off the panel's outer edge rather than putting it in the
 * header — see `leads-manage-columns-drawer-open.png` and
 * `leads-add-new-lead-drawer-scroll-1-top.png`. It rides inside the dialog element so the
 * focus trap still reaches it.
 */
const CLOSE_CLASS =
  "absolute top-5 right-full inline-flex size-control-lg items-center justify-center rounded-l-control bg-surface text-ink shadow-md transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas focus-ring";

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
  width = "max-w-2xl",
}: DrawerPanelProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useDismissable(panel, true, onClose);
  useDialogA11y(panel, true);

  // The panel must commit off-screen before the class flips, or there is nothing to ease.
  const [slidIn, setSlidIn] = useState(false);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setSlidIn(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    // Workpex tucks the drawer under the navbar and dims nothing behind it: the list stays
    // legible while columns are rearranged against it. With no backdrop to absorb them, the
    // frame must let pointer events fall through to the page it is sitting on.
    <div className="pointer-events-none fixed top-navbar right-0 bottom-0 left-0 z-50 flex justify-end">
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "pointer-events-auto relative flex h-full w-full transition-transform duration-(--duration-shell) ease-shell focus:outline-none",
          width,
          slidIn ? "translate-x-0" : "translate-x-full",
        )}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className={CLOSE_CLASS}
        >
          <IconX aria-hidden="true" stroke={2} className="size-5" />
        </button>

        <div className="flex h-full w-full flex-col border-l border-hairline bg-surface shadow-xl">
          <header className="p-5">
            <h2 id={titleId} className="text-lg font-medium text-ink">
              {title}
            </h2>
          </header>

          <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-5 text-sm text-ink scrollbar-slim">
            {children}
          </div>

          {footer && (
            <footer className="flex items-center justify-end gap-3 border-t border-hairline p-5">
              {footer}
            </footer>
          )}
        </div>
      </div>
    </div>
  );
}

export function Drawer({ open, ...panelProps }: DrawerProps) {
  const mounted = useMounted();

  if (!open || !mounted) return null;

  return createPortal(<DrawerPanel {...panelProps} />, document.body);
}
