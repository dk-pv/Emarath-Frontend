"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { FormField } from "@/components/ui/FormField";
import { Input } from "@/components/ui/Input";
import { Modal } from "@/components/ui/Modal";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { ApiError } from "@/lib/api-client";
import {
  AWB_MAX_LENGTH,
  COURIER_MAX_LENGTH,
  REASON_MAX_LENGTH,
  SHIPMENT_ACTION_LABEL,
  dispatchAwbError,
  orderNumberLabel,
  refetchAfterFailure,
  type ShipmentAction,
  type ShipmentActionInput,
} from "@/lib/logistics-orders";
import {
  fetchLogisticsOrder,
  runShipmentAction,
  type LogisticsOrder,
} from "@/services/logistics-service";

/** Secondary steps first, the forward step last — the footer's primary sits on the right. */
const FOOTER_ORDER: readonly ShipmentAction[] = [
  "CANCEL",
  "RTO",
  "DELIVER",
  "DISPATCH",
];

const DONE: Record<ShipmentAction, string> = {
  DISPATCH: "dispatched",
  DELIVER: "marked as delivered",
  CANCEL: "cancelled",
  RTO: "marked as RTO",
};

/**
 * The order panel's shipment actions (ADR-0085). It renders exactly the `actions` the backend
 * offered this caller for this order — never working anything out from role or status — and
 * each one sends its backend DTO as it stands: an AWB required and a courier optional at
 * dispatch, an optional reason for cancel and RTO, nothing for delivery.
 *
 * The backend stays the authority. A success hands back the order as it now stands, which
 * replaces the panel's copy (new status, new `allowedActions`). A 403, 404 or 409 means the order
 * or the caller's rights moved on since the panel loaded: the API's own message is shown and the
 * order is read again, so the panel shows the truth — never retried, never patched locally.
 */
export function LogisticsOrderActions({
  order,
  actions,
  onOrderChange,
}: {
  order: LogisticsOrder;
  actions: readonly ShipmentAction[];
  onOrderChange: (order: LogisticsOrder) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState<ShipmentAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [awbNumber, setAwbNumber] = useState("");
  const [courier, setCourier] = useState("");
  const [reason, setReason] = useState("");
  const [awbError, setAwbError] = useState<string | undefined>();

  const label = orderNumberLabel(order.orderNumber);

  const begin = (action: ShipmentAction) => {
    setAwbNumber("");
    setCourier("");
    setReason("");
    setAwbError(undefined);
    setOpen(action);
  };
  const dismiss = () => {
    if (!busy) setOpen(null);
  };

  const reload = async () => {
    try {
      onOrderChange(await fetchLogisticsOrder(order.id));
    } catch {
      toast({ title: "Couldn’t refresh the order", tone: "danger" });
    }
  };

  const submit = async (input: ShipmentActionInput) => {
    setBusy(true);
    try {
      const updated = await runShipmentAction(order.id, input);
      setOpen(null);
      toast({ title: `Order ${label} ${DONE[input.action]}`, tone: "success" });
      onOrderChange(updated);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      toast({
        title:
          (error instanceof ApiError && error.messages.join(" · ")) ||
          "Couldn’t update the order — try again.",
        tone: "danger",
      });
      if (refetchAfterFailure(status)) {
        setOpen(null);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  const dispatch = () => {
    const error = dispatchAwbError(awbNumber);
    setAwbError(error);
    if (!error) void submit({ action: "DISPATCH", awbNumber, courier });
  };

  const reasonField = (
    <FormField label="Reason" hint="Optional">
      {(control) => (
        <Textarea
          {...control}
          value={reason}
          maxLength={REASON_MAX_LENGTH}
          rows={3}
          onChange={(event) => setReason(event.target.value)}
        />
      )}
    </FormField>
  );

  return (
    <>
      {FOOTER_ORDER.filter((action) => actions.includes(action)).map(
        (action) => (
          <Button
            key={action}
            variant={
              action === "DISPATCH" || action === "DELIVER"
                ? "primary"
                : "secondary"
            }
            disabled={busy}
            onClick={() => begin(action)}
          >
            {SHIPMENT_ACTION_LABEL[action]}
          </Button>
        ),
      )}

      <Modal
        open={open === "DISPATCH"}
        onClose={dismiss}
        title={`Dispatch order ${label}`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={dismiss} disabled={busy}>
              Cancel
            </Button>
            <Button variant="primary" isLoading={busy} onClick={dispatch}>
              Dispatch
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-4">
          <FormField label="AWB / Tracking Number" required error={awbError}>
            {(control) => (
              <Input
                {...control}
                value={awbNumber}
                maxLength={AWB_MAX_LENGTH}
                autoFocus
                onChange={(event) => {
                  setAwbNumber(event.target.value);
                  if (awbError) setAwbError(undefined);
                }}
              />
            )}
          </FormField>
          <FormField label="Courier" hint="Optional">
            {(control) => (
              <Input
                {...control}
                value={courier}
                maxLength={COURIER_MAX_LENGTH}
                onChange={(event) => setCourier(event.target.value)}
              />
            )}
          </FormField>
        </div>
      </Modal>

      <ConfirmDialog
        open={open === "DELIVER"}
        onCancel={dismiss}
        onConfirm={() => void submit({ action: "DELIVER" })}
        title={`Mark order ${label} as delivered?`}
        description="The order will move to Delivered."
        confirmLabel="Mark as delivered"
        busy={busy}
      />

      <Modal
        open={open === "CANCEL"}
        onClose={dismiss}
        title={`Cancel order ${label}?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={dismiss} disabled={busy}>
              Keep order
            </Button>
            <Button
              variant="danger"
              isLoading={busy}
              onClick={() => void submit({ action: "CANCEL", reason })}
            >
              Cancel order
            </Button>
          </>
        }
      >
        {reasonField}
      </Modal>

      <Modal
        open={open === "RTO"}
        onClose={dismiss}
        title={`Mark order ${label} as RTO?`}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={dismiss} disabled={busy}>
              Cancel
            </Button>
            <Button
              variant="primary"
              isLoading={busy}
              onClick={() => void submit({ action: "RTO", reason })}
            >
              Mark as RTO
            </Button>
          </>
        }
      >
        {reasonField}
      </Modal>
    </>
  );
}
