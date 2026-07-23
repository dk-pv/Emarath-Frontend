"use client";

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { IconCheck, IconLoader2 } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useStages } from "@/components/stages/stages-context";
import type { LeadListItem } from "@/services/leads-service";

/**
 * The Lead Status badge (LEAD-11.1). A colour-coded pill whose colour and catalogue
 * come from the canonical stage source (`useStages`, KAN-05.2) — the same source the
 * board reads, so list and board can never drift.
 *
 * `lead-status.mp4` reveals the badge is also an inline editor: clicking it opens a
 * colour-swatched dropdown of the whole stage catalogue, and picking a status
 * changes it. The dropdown/click-flow/swatches/hover are captured there; the save
 * flow (loading, optimistic, success/error) is NOT — so it is a documented fallback
 * (ADR-0015): optimistic badge update + the LEAD-10.1 set-status API + a toast,
 * wired through `LeadStatusProvider`. Requires a `StagesProvider` above it.
 */

type StatusContextValue = {
  onChange: (lead: LeadListItem, status: string) => void;
  /** The lead whose status change is in flight — drives the badge's pending state. */
  pendingId: string | null;
};

const StatusContext = createContext<StatusContextValue | null>(null);

/** Supplies the inline status-change handler and pending state to every badge. */
export function LeadStatusProvider({
  value,
  children,
}: {
  value: StatusContextValue;
  children: ReactNode;
}) {
  return <StatusContext value={value}>{children}</StatusContext>;
}

/** Same pill geometry as Workpex — rounded-full, small, medium weight. */
const BADGE_CLASS =
  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium";

export function LeadStatusBadge({ lead }: { lead: LeadListItem }) {
  const ctx = useContext(StatusContext);
  const { colorsFor } = useStages();
  const badgeCls = colorsFor(lead.status).badge;

  // No provider (e.g. reused outside the list): a plain, non-interactive pill.
  if (!ctx) {
    return <span className={cn(BADGE_CLASS, badgeCls)}>{lead.status}</span>;
  }

  return <InteractiveStatusBadge lead={lead} ctx={ctx} badgeCls={badgeCls} />;
}

function InteractiveStatusBadge({
  lead,
  ctx,
  badgeCls,
}: {
  lead: LeadListItem;
  ctx: StatusContextValue;
  badgeCls: string;
}) {
  const { stages, colorsFor } = useStages();
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{
    top: number;
    left: number;
    width: number;
  } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const pending = ctx.pendingId === lead.id;

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !btnRef.current?.contains(target) &&
        !panelRef.current?.contains(target)
      ) {
        close();
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    // The panel is viewport-fixed at the badge, so any scroll would detach it.
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  const toggle = () => {
    if (pending) return;
    const r = btnRef.current?.getBoundingClientRect();
    if (r) setRect({ top: r.bottom + 4, left: r.left, width: r.width });
    setOpen((value) => !value);
  };

  const pick = (status: string) => {
    setOpen(false);
    if (status !== lead.status) ctx.onChange(lead, status);
  };

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={toggle}
        disabled={pending}
        aria-haspopup="listbox"
        aria-expanded={open}
        className={cn(
          BADGE_CLASS,
          badgeCls,
          "focus-ring cursor-pointer gap-1 transition-opacity",
          pending && "opacity-60",
        )}
      >
        {lead.status}
        {pending && (
          <IconLoader2 size={12} className="animate-spin" aria-hidden="true" />
        )}
      </button>

      {open &&
        rect &&
        createPortal(
          <div
            ref={panelRef}
            role="listbox"
            aria-label="Set lead status"
            style={{
              position: "fixed",
              top: rect.top,
              left: rect.left,
              minWidth: Math.max(rect.width, 208),
            }}
            className="z-50 max-h-72 overflow-y-auto rounded-surface border border-hairline bg-surface py-1 shadow-lg"
          >
            {stages.map((option) => {
              const selected = option.name === lead.status;
              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => pick(option.name)}
                  className="focus-ring-inset flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
                >
                  <span
                    className={cn(
                      "size-3.5 shrink-0 rounded-sm",
                      colorsFor(option.name).swatch,
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1">{option.name}</span>
                  {selected && (
                    <IconCheck
                      size={16}
                      stroke={2}
                      className="shrink-0 text-brand-strong"
                      aria-hidden="true"
                    />
                  )}
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}
