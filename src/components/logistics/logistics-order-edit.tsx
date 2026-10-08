"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import {
  ORDER_EDIT_FIELDS,
  orderEditChanges,
  orderEditErrors,
  orderEditValues,
  orderNumberLabel,
  type OrderEditField,
  type OrderEditValues,
} from "@/lib/logistics-orders";
import type { LogisticsOrder } from "@/services/logistics-service";

/**
 * The Logistics Manager's correction of a QC-verified order (client clarification 2026-10-01,
 * Q5): the order's own copy of the customer and order data, in the order panel's own labels.
 * The order stays QC Verified — it does not go back to QC — and the lead is not touched.
 *
 * Only changed fields are sent; the backend writes and audits exactly those.
 */
export function LogisticsOrderEditModal({
  order,
  busy,
  onClose,
  onSave,
}: {
  order: LogisticsOrder;
  busy: boolean;
  onClose: () => void;
  onSave: (changes: Partial<OrderEditValues>) => void;
}) {
  const [initial] = useState(() => orderEditValues(order));
  const [draft, setDraft] = useState<OrderEditValues>(initial);
  const [errors, setErrors] = useState<Partial<Record<OrderEditField, string>>>(
    {},
  );
  const changes = orderEditChanges(initial, draft);
  const changed = Object.keys(changes).length > 0;

  const save = () => {
    const found = orderEditErrors(draft);
    setErrors(found);
    if (Object.keys(found).length === 0 && changed) onSave(changes);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={`Edit order ${orderNumberLabel(order.orderNumber)}`}
      size="lg"
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="primary"
            isLoading={busy}
            disabled={!changed}
            onClick={save}
          >
            Save changes
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <p className="text-ink-muted">
          Corrects this order only. It stays QC Verified, and the lead is not
          changed.
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          {ORDER_EDIT_FIELDS.map((field) => (
            <FormField
              key={field.key}
              label={field.label}
              required={"required" in field}
              error={errors[field.key]}
            >
              {(control) => (
                <Input
                  {...control}
                  value={draft[field.key]}
                  maxLength={field.maxLength}
                  inputMode={"numeric" in field ? "decimal" : undefined}
                  onChange={(event) => {
                    const value = event.target.value;
                    setDraft((current) => ({ ...current, [field.key]: value }));
                    if (errors[field.key]) {
                      setErrors((current) => ({
                        ...current,
                        [field.key]: undefined,
                      }));
                    }
                  }}
                />
              )}
            </FormField>
          ))}
        </div>
      </div>
    </Modal>
  );
}
