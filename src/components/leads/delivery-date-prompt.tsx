"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { DatePicker } from "@/components/ui/DatePicker";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { dateKey, keyBound } from "@/lib/date-time-range";
import { formatDateOnly } from "@/lib/logistics-orders";

/**
 * Asks for the requested delivery date whenever a lead is converted to WON — Convert, a status
 * change or a board move into WON. Every new order must have a delivery date, which Sales sets
 * (client, 2026-10-17); converting creates the order, so the day is asked for first. Promise-based,
 * like the lost-reason prompt, so a caller's existing async handler barely changes:
 *
 *   const day = await ask(lead);
 *   if (day === DELIVERY_DATE_CANCELLED) return;   // nothing is changed
 *
 * There is no Skip: the server refuses a conversion without a date, whatever the UI sends. Whether
 * the day is before today is the server's rule — measured in the business timezone, not this
 * browser's — and its refusal reaches the caller like any other.
 */
export const DELIVERY_DATE_CANCELLED = Symbol("delivery-date-cancelled");

type Pending = {
  name: string;
  resolve: (value: string | typeof DELIVERY_DATE_CANCELLED) => void;
};

export function useDeliveryDatePrompt() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [day, setDay] = useState("");
  const pendingRef = useRef<Pending | null>(null);

  const ask = useCallback(
    (lead: { name: string }) =>
      new Promise<string | typeof DELIVERY_DATE_CANCELLED>((resolve) => {
        const next = { name: lead.name, resolve };
        pendingRef.current = next;
        setDay("");
        setPending(next);
      }),
    [],
  );

  const settle = (value: string | typeof DELIVERY_DATE_CANCELLED) => {
    pendingRef.current?.resolve(value);
    pendingRef.current = null;
    setPending(null);
  };

  const modal = pending ? (
    <Modal
      open
      onClose={() => settle(DELIVERY_DATE_CANCELLED)}
      title="Convert lead"
      size="sm"
      footer={
        <>
          <Button
            variant="ghost"
            onClick={() => settle(DELIVERY_DATE_CANCELLED)}
          >
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={() => settle(day)}
            disabled={day === ""}
          >
            Confirm
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          Converting “{pending.name}” sets its status to WON and creates its
          Logistics order, which needs the delivery date the customer asked for.
        </p>
        <FormField label="Delivery Date" required hint="Today or a later day.">
          {(control) => (
            // A calendar day: the picker's local date is kept as its YYYY-MM-DD parts, never
            // converted to an instant, so no timezone can move it.
            <DatePicker
              numeric
              value={keyBound(day).day}
              onChange={(picked) => setDay(picked ? dateKey(picked) : "")}
              placeholder="DD/MM/YYYY"
              aria-label={
                day
                  ? `Delivery Date, ${formatDateOnly(day)}`
                  : "Delivery Date, not set"
              }
              aria-describedby={control["aria-describedby"]}
            />
          )}
        </FormField>
      </div>
    </Modal>
  ) : null;

  return { ask, modal };
}
