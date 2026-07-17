"use client";

import {
  useEffect,
  useId,
  useRef,
  useSyncExternalStore,
  type RefObject,
} from "react";
import { createPortal } from "react-dom";
import { IconX } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDismissable } from "@/hooks/use-dismissable";
import type { Size } from "@/types";

const SIZE_CLASS: Record<Size, string> = {
  sm: "max-w-md",
  md: "max-w-lg",
  lg: "max-w-2xl",
};

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

const CLOSE_CLASS =
  "-mt-1 -mr-1 inline-flex size-control-sm shrink-0 items-center justify-center rounded-control text-ink-muted transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas hover:text-ink focus-ring";

/**
 * The half of `aria-modal` the browser does not implement: Tab stays inside the panel,
 * focus moves in on open and back to the opener on close, and the page behind cannot
 * scroll. Exported so Drawer shares one implementation rather than a copy.
 */
export function useDialogA11y(
  panel: RefObject<HTMLElement | null>,
  isActive: boolean,
) {
  useEffect(() => {
    if (!isActive) return;

    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const bodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    // Drawer focuses while still translated off-screen, so scrolling must be suppressed.
    panel.current?.focus({ preventScroll: true });

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || !panel.current) return;

      const nodes = Array.from(
        panel.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR),
      );
      const first = nodes[0];
      const last = nodes[nodes.length - 1];

      if (!first || !last) {
        event.preventDefault();
        return;
      }

      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === panel.current)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = bodyOverflow;
      opener?.focus();
    };
  }, [isActive, panel]);
}

const NOOP_SUBSCRIBE = () => () => {};
const MOUNTED = () => true;
const NOT_MOUNTED = () => false;

/**
 * Portals only after mount so the server render and the hydration pass agree.
 * `useSyncExternalStore` gives that server/client split directly; a setState in an
 * effect would cascade a render and trip `react-hooks/set-state-in-effect`.
 */
export function useMounted() {
  return useSyncExternalStore(NOOP_SUBSCRIBE, MOUNTED, NOT_MOUNTED);
}

export type ModalProps = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: Size;
};

export function Modal({
  open,
  onClose,
  title,
  children,
  footer,
  size = "md",
}: ModalProps) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const mounted = useMounted();
  const isActive = open && mounted;

  // The ref is the panel, so a backdrop press reads as "outside" and closes.
  useDismissable(panel, isActive, onClose);
  useDialogA11y(panel, isActive);

  if (!isActive) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div aria-hidden="true" className="absolute inset-0 bg-ink/50" />

      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cn(
          "relative flex max-h-full w-full flex-col rounded-surface border border-hairline bg-surface shadow-xl focus:outline-none",
          SIZE_CLASS[size],
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
    </div>,
    document.body,
  );
}
