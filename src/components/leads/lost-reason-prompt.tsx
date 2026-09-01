"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useLookup } from "@/hooks/use-lookup";
import type { LeadListItem } from "@/services/leads-service";

/** The status that triggers the prompt — mirrors the backend's `LOST_STATUS`. */
export const LOST_STATUS = "LOST";

/**
 * Asks why a lead is being lost, whenever a status change or board move targets LOST
 * (RPT-02.7 v2). Reasons come from the `lostReasons` catalogue through the shared
 * `useLookup` cache — the same list the Lost Leads report groups by — so a captured
 * reason can only ever be a catalogue value.
 *
 * Promise-based so a caller's existing async handler barely changes:
 *
 *   const reason = status === LOST_STATUS ? await ask(lead) : undefined;
 *   if (reason === CANCELLED) return;      // the user dismissed the dialog
 *
 * Skipping is allowed (the lead is still lost, just without a recorded reason) — a
 * required reason would block a status change the user has already decided on.
 */
export const CANCELLED = Symbol("lost-reason-cancelled");

type Pending = {
  lead: LeadListItem;
  resolve: (value: string | undefined | typeof CANCELLED) => void;
};

export function useLostReasonPrompt() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [selected, setSelected] = useState<string>("");
  const pendingRef = useRef<Pending | null>(null);
  const { options, isLoading } = useLookup("lostReasons");

  const ask = useCallback(
    (lead: LeadListItem) =>
      new Promise<string | undefined | typeof CANCELLED>((resolve) => {
        const next = { lead, resolve };
        pendingRef.current = next;
        setSelected("");
        setPending(next);
      }),
    [],
  );

  const settle = (value: string | undefined | typeof CANCELLED) => {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  };

  const modal = pending ? (
    <Modal
      open
      onClose={() => settle(CANCELLED)}
      title="Why was this lead lost?"
      size="sm"
      footer={
        <>
          <Button variant="ghost" onClick={() => settle(undefined)}>
            Skip
          </Button>
          <Button
            variant="primary"
            onClick={() => settle(selected || undefined)}
            disabled={isLoading || selected === ""}
          >
            Mark as lost
          </Button>
        </>
      }
    >
      <fieldset className="space-y-1">
        <legend className="mb-2 text-sm text-ink-muted">
          Record why “{pending.lead.name}” was lost. The Lost Leads report
          groups by this reason.
        </legend>
        {options.map((option) => (
          <label
            key={option.value}
            className="flex cursor-pointer items-center gap-3 rounded-control px-3 py-2 text-sm text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas"
          >
            <input
              type="radio"
              name="lost-reason"
              value={option.value}
              checked={selected === option.value}
              onChange={() => setSelected(option.value)}
              className="size-4 accent-brand"
            />
            <span>{option.label}</span>
          </label>
        ))}
      </fieldset>
    </Modal>
  ) : null;

  return { ask, modal };
}
