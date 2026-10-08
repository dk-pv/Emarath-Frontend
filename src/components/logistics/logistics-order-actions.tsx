"use client";

import { useEffect, useState } from "react";
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
  ORDER_ACTION_LABEL,
  QC_REMARKS_MAX_LENGTH,
  REASON_MAX_LENGTH,
  dispatchAwbError,
  orderNumberLabel,
  refetchAfterFailure,
  requiredReasonError,
  type OrderAction,
  type OrderActionInput,
} from "@/lib/logistics-orders";
import {
  fetchLogisticsOrder,
  runOrderAction,
  type LogisticsOrder,
} from "@/services/logistics-service";
import { LogisticsOrderEditModal } from "./logistics-order-edit";

const PRIMARY: ReadonlySet<OrderAction> = new Set([
  "QC_VERIFY",
  "RESUBMIT",
  "DELIVER",
  "DISPATCH",
]);

const DONE: Record<OrderAction, string> = {
  QC_VERIFY: "verified by QC",
  QC_REJECT: "rejected by QC",
  RESUBMIT: "resubmitted to QC",
  EDIT: "updated",
  CORRECT_AWB: "AWB corrected",
  DISPATCH: "dispatched",
  DELIVER: "marked as delivered",
  CANCEL: "cancelled",
  RTO: "marked as RTO",
};

/** The API's refusal of an AWB another order already holds — a field error, not a reload. */
const AWB_TAKEN = /AWB.*already used/i;

/**
 * The order panel's actions (ADR-0085, client clarification of 2026-10-01). It renders exactly
 * the `actions` the backend offered this caller for this order — never working anything out
 * from role or status — and each one sends its backend DTO as it stands: QC's optional approval
 * remarks and mandatory rejection reason, an optional note on a resubmit, an AWB required at
 * dispatch, a mandatory reason for cancel and RTO, and the Logistics Manager's two corrections.
 *
 * The backend stays the authority. A success hands back the order as it now stands, which
 * replaces the panel's copy (new status, new `allowedActions`). A 403, 404 or 409 means the order
 * or the caller's rights moved on since the panel loaded: the API's own message is shown and the
 * order is read again, so the panel shows the truth — never retried, never patched locally. The
 * one exception is an AWB another order holds, which stays in the form for a different one.
 *
 * `onDialogChange` tells the drawer when one of these dialogs is open. They render above it, in
 * a portal, so a press inside one is "outside" the drawer — and must not close it.
 */
export function LogisticsOrderActions({
  order,
  actions,
  onOrderChange,
  onDialogChange,
}: {
  order: LogisticsOrder;
  actions: readonly OrderAction[];
  onOrderChange: (order: LogisticsOrder) => void;
  onDialogChange: (open: boolean) => void;
}) {
  const { toast } = useToast();
  const [open, setOpen] = useState<OrderAction | null>(null);
  const [busy, setBusy] = useState(false);
  const [awbNumber, setAwbNumber] = useState("");
  const [courier, setCourier] = useState("");
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();

  // Reset on unmount too: a successful action can leave no actions, and the panel goes with
  // them while its dialog was still the open one.
  useEffect(() => {
    onDialogChange(open !== null);
    return () => onDialogChange(false);
  }, [open, onDialogChange]);

  const label = orderNumberLabel(order.orderNumber);

  const begin = (action: OrderAction) => {
    setAwbNumber("");
    setCourier("");
    setText("");
    setFieldError(undefined);
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

  const submit = async (input: OrderActionInput) => {
    setBusy(true);
    try {
      const updated = await runOrderAction(order.id, input);
      setOpen(null);
      toast({ title: `Order ${label} ${DONE[input.action]}`, tone: "success" });
      onOrderChange(updated);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message =
        (error instanceof ApiError && error.messages.join(" · ")) ||
        "Couldn’t update the order — try again.";
      if (
        (input.action === "DISPATCH" || input.action === "CORRECT_AWB") &&
        status === 409 &&
        AWB_TAKEN.test(message)
      ) {
        setFieldError(message);
        return;
      }
      toast({ title: message, tone: "danger" });
      if (refetchAfterFailure(status)) {
        setOpen(null);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  /** Submits when `error` finds nothing; otherwise shows it on the field. */
  const checked = (error: string | undefined, input: OrderActionInput) => {
    setFieldError(error);
    if (!error) void submit(input);
  };

  const textField = (
    fieldLabel: string,
    options: { required?: boolean; maxLength: number },
  ) => (
    <FormField
      label={fieldLabel}
      required={options.required}
      hint={options.required ? undefined : "Optional"}
      error={options.required ? fieldError : undefined}
    >
      {(control) => (
        <Textarea
          {...control}
          value={text}
          maxLength={options.maxLength}
          rows={3}
          autoFocus
          onChange={(event) => {
            setText(event.target.value);
            if (fieldError) setFieldError(undefined);
          }}
        />
      )}
    </FormField>
  );

  const awbField = (fieldLabel: string) => (
    <FormField label={fieldLabel} required error={fieldError}>
      {(control) => (
        <Input
          {...control}
          value={awbNumber}
          maxLength={AWB_MAX_LENGTH}
          autoFocus
          onChange={(event) => {
            setAwbNumber(event.target.value);
            if (fieldError) setFieldError(undefined);
          }}
        />
      )}
    </FormField>
  );

  const footer = (
    confirmLabel: string,
    onConfirm: () => void,
    danger = false,
  ) => (
    <>
      <Button variant="ghost" onClick={dismiss} disabled={busy}>
        Cancel
      </Button>
      <Button
        variant={danger ? "danger" : "primary"}
        isLoading={busy}
        onClick={onConfirm}
      >
        {confirmLabel}
      </Button>
    </>
  );

  return (
    // Its own wrapping row: the drawer's footer does not wrap, and four controls do not fit
    // side by side on a phone.
    <div className="flex flex-wrap items-center justify-end gap-3">
      {/* `actions` is `renderableActions`' list, already in the footer's order. */}
      {actions.map((action) => (
        <Button
          key={action}
          variant={PRIMARY.has(action) ? "primary" : "secondary"}
          disabled={busy}
          onClick={() => begin(action)}
        >
          {ORDER_ACTION_LABEL[action]}
        </Button>
      ))}

      <Modal
        open={open === "QC_VERIFY"}
        onClose={dismiss}
        title={`QC verify order ${label}`}
        size="sm"
        footer={footer(
          "Verify",
          () => void submit({ action: "QC_VERIFY", remarks: text }),
        )}
      >
        {textField("Remarks", { maxLength: QC_REMARKS_MAX_LENGTH })}
      </Modal>

      <Modal
        open={open === "QC_REJECT"}
        onClose={dismiss}
        title={`Reject order ${label}`}
        size="sm"
        footer={footer(
          "Reject order",
          () =>
            checked(requiredReasonError(text), {
              action: "QC_REJECT",
              remarks: text,
            }),
          true,
        )}
      >
        <div className="flex flex-col gap-4">
          {/* Describes the backend as built; "A Sales Manager" follows
              RESUBMIT_ROLES and changes with open client question Q18. */}
          <p className="text-ink-muted">
            The lead moves to QC NOT APPROVED so Sales can correct it. A Sales
            Manager then resubmits this same order.
          </p>
          {textField("Rejection reason", {
            required: true,
            maxLength: QC_REMARKS_MAX_LENGTH,
          })}
        </div>
      </Modal>

      <Modal
        open={open === "RESUBMIT"}
        onClose={dismiss}
        title={`Resubmit order ${label} to QC`}
        size="sm"
        footer={footer(
          "Resubmit",
          () => void submit({ action: "RESUBMIT", remarks: text }),
        )}
      >
        <div className="flex flex-col gap-4">
          {/* Describes `resubmit` as built; the second sentence changes with
              open client question Q10 (snapshot refresh on resubmit). */}
          <p className="text-ink-muted">
            The same order goes back to QC and the lead returns to Won. QC
            reviews the order’s details as they were captured — corrections made
            on the lead are not copied onto the order.
          </p>
          {textField("Note", { maxLength: QC_REMARKS_MAX_LENGTH })}
        </div>
      </Modal>

      <Modal
        open={open === "DISPATCH"}
        onClose={dismiss}
        title={`Dispatch order ${label}`}
        size="sm"
        footer={footer("Dispatch", () =>
          checked(dispatchAwbError(awbNumber), {
            action: "DISPATCH",
            awbNumber,
            courier,
          }),
        )}
      >
        <div className="flex flex-col gap-4">
          {awbField("AWB / Tracking Number")}
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
        footer={footer(
          "Cancel order",
          () =>
            checked(requiredReasonError(text), {
              action: "CANCEL",
              reason: text,
            }),
          true,
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">
            A cancelled order cannot move to any other status.
          </p>
          {textField("Cancellation reason", {
            required: true,
            maxLength: REASON_MAX_LENGTH,
          })}
        </div>
      </Modal>

      <Modal
        open={open === "RTO"}
        onClose={dismiss}
        title={`Mark order ${label} as RTO?`}
        size="sm"
        footer={footer("Mark as RTO", () =>
          checked(requiredReasonError(text), { action: "RTO", reason: text }),
        )}
      >
        {textField("RTO reason", {
          required: true,
          maxLength: REASON_MAX_LENGTH,
        })}
      </Modal>

      <Modal
        open={open === "CORRECT_AWB"}
        onClose={dismiss}
        title={`Correct the AWB of order ${label}`}
        size="sm"
        footer={footer("Save AWB", () =>
          checked(dispatchAwbError(awbNumber), {
            action: "CORRECT_AWB",
            awbNumber,
          }),
        )}
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">
            Current AWB:{" "}
            <span className="font-medium text-ink">
              {order.awbNumber ?? "—"}
            </span>
            . The old number stays in the order’s Journey.
          </p>
          {awbField("New AWB / Tracking Number")}
        </div>
      </Modal>

      {open === "EDIT" && (
        <LogisticsOrderEditModal
          order={order}
          busy={busy}
          onClose={dismiss}
          onSave={(changes) => void submit({ action: "EDIT", changes })}
        />
      )}
    </div>
  );
}
