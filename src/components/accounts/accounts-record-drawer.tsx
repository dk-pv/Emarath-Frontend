"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { DetailSection } from "@/components/ui/DetailSection";
import { Drawer } from "@/components/ui/Drawer";
import { FormField } from "@/components/ui/FormField";
import { Modal } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { TabStrip } from "@/components/ui/Tabs";
import { Textarea } from "@/components/ui/Textarea";
import { useToast } from "@/components/ui/Toast";
import { CustomerJourney } from "@/components/leads/customer-journey";
import { PaymentStatusBadge } from "@/components/accounts/payment-status-badge";
import { ApiError } from "@/lib/api-client";
import {
  CORRECTION_REASON_MAX_LENGTH,
  PAYMENT_STATUSES,
  REMARKS_MAX_LENGTH,
  correctionReasonError,
  correctionTargets,
  paymentStatusLabel,
  refetchAfterRefusal,
  type PaymentStatus,
} from "@/lib/accounts-records";
import { formatAED, formatDateTime } from "@/lib/format";
import {
  formatDateOnly,
  logisticsOrderHref,
  orderNumberLabel,
} from "@/lib/logistics-orders";
import {
  correctPaymentStatus,
  fetchAccountsRecord,
  movePaymentStatus,
  type AccountsRecord,
} from "@/services/accounts-service";

const TABS = [
  { id: "details", label: "Details" },
  { id: "journey", label: "Journey" },
] as const;

const when = (iso: string | null) => (iso ? formatDateTime(iso) : null);

/** The statuses as options, in the pipeline's order; only `allowed` ones are offered. */
const statusOptions = (allowed: readonly string[]) =>
  PAYMENT_STATUSES.filter((status) => allowed.includes(status)).map(
    (status) => ({ value: status, label: paymentStatusLabel(status) }),
  );

type Dialog = "move" | "correct" | null;

/**
 * One delivered order's payment record: its status, the order it belongs to, and — in the
 * Journey tab — the whole recorded history Accounts may read (the order's events and the
 * record's own, ADR-0083/0096).
 *
 * Its actions are the backend's for this caller: "Update status" offers exactly `allowedMoves`
 * (the provisional moves, pending the client), and "Correct status" appears only when
 * `canCorrect` — the Super Admin's alone until the client names the Accounts head. Each request
 * carries the status the panel shows as `expectedStatus`, so a record someone else changed
 * meanwhile is refused rather than overwritten: the API's message is shown and the record is read
 * again, never patched locally.
 */
export function AccountsRecordDrawer({
  record,
  onClose,
  onRecordChange,
}: {
  record: AccountsRecord;
  onClose: () => void;
  /** The record as the server now has it, after a change or a refresh. */
  onRecordChange: (record: AccountsRecord) => void;
}) {
  const { toast } = useToast();
  const [tab, setTab] = useState<string>("details");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [target, setTarget] = useState("");
  const [text, setText] = useState("");
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);

  const order = record.order;
  const label = orderNumberLabel(order.orderNumber);
  const moves = statusOptions(record.allowedMoves);
  const corrections = statusOptions(correctionTargets(record.status));

  const begin = (next: Exclude<Dialog, null>) => {
    setTarget("");
    setText("");
    setFieldError(undefined);
    setDialog(next);
  };
  const dismiss = () => {
    if (!busy) setDialog(null);
  };

  const reload = async () => {
    try {
      onRecordChange(await fetchAccountsRecord(record.id));
    } catch {
      toast({ title: "Couldn’t refresh the record", tone: "danger" });
    }
  };

  const submit = async () => {
    const status = target as PaymentStatus;
    if (dialog === "correct") {
      const error = correctionReasonError(text);
      setFieldError(error);
      if (error) return;
    }
    setBusy(true);
    try {
      const updated =
        dialog === "correct"
          ? await correctPaymentStatus(record.id, {
              status,
              expectedStatus: record.status,
              reason: text.trim(),
            })
          : await movePaymentStatus(record.id, {
              status,
              expectedStatus: record.status,
              ...(text.trim() ? { remarks: text.trim() } : {}),
            });
      setDialog(null);
      toast({
        title: `Order ${label}: ${paymentStatusLabel(updated.status)}`,
        tone: "success",
      });
      onRecordChange(updated);
    } catch (error) {
      const status = error instanceof ApiError ? error.status : undefined;
      const message =
        (error instanceof ApiError && error.messages.join(" · ")) ||
        "Couldn’t update the payment status — try again.";
      if (status === 400) {
        setFieldError(message);
        return;
      }
      toast({ title: message, tone: "danger" });
      if (refetchAfterRefusal(status)) {
        setDialog(null);
        await reload();
      }
    } finally {
      setBusy(false);
    }
  };

  const footer = (confirmLabel: string) => (
    <>
      <Button variant="ghost" onClick={dismiss} disabled={busy}>
        Cancel
      </Button>
      <Button
        isLoading={busy}
        disabled={!target || (dialog === "correct" && !text.trim())}
        onClick={() => void submit()}
      >
        {confirmLabel}
      </Button>
    </>
  );

  const statusField = (options: { value: string; label: string }[]) => (
    <FormField label="New status" required>
      {(control) => (
        <Select
          {...control}
          value={target}
          options={options}
          placeholder="Choose a status"
          onChange={(event) => setTarget(event.target.value)}
        />
      )}
    </FormField>
  );

  const actions =
    moves.length > 0 || record.canCorrect ? (
      <div className="flex flex-wrap items-center justify-end gap-3">
        {record.canCorrect && (
          <Button
            variant="secondary"
            disabled={busy}
            onClick={() => begin("correct")}
          >
            Correct status
          </Button>
        )}
        {moves.length > 0 && (
          <Button disabled={busy} onClick={() => begin("move")}>
            Update status
          </Button>
        )}
      </div>
    ) : undefined;

  return (
    <Drawer
      open
      onClose={() => {
        // A dialog sits above the drawer in a portal; a press inside it must not close the drawer.
        if (!dialog) onClose();
      }}
      title={`Payment for order ${label}`}
      width="max-w-xl"
      footer={actions}
      header={
        <header className="border-b border-hairline p-4">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-ink">
              Payment for order {label}
            </h2>
            <PaymentStatusBadge status={record.status} />
          </div>
          <TabStrip
            className="mt-3"
            tabs={TABS}
            value={tab}
            onValueChange={setTab}
          />
        </header>
      }
    >
      {tab === "journey" ? (
        <CustomerJourney leadId={order.leadId} />
      ) : (
        <div className="flex flex-col gap-4">
          <DetailSection
            title="Payment"
            fields={[
              {
                label: "Payment Status",
                value: <PaymentStatusBadge status={record.status} />,
              },
              { label: "Status Updated", value: when(record.statusChangedAt) },
              { label: "Entered Accounts", value: when(record.createdAt) },
            ]}
          />
          <DetailSection
            title="Order"
            fields={[
              {
                label: "Order Number",
                value: (
                  <Link
                    href={logisticsOrderHref(order.id)}
                    className="focus-ring rounded-control text-brand-strong underline"
                  >
                    {label}
                  </Link>
                ),
              },
              {
                label: "Order Value",
                value: order.orderValue ? formatAED(order.orderValue) : null,
              },
              { label: "Payment Method", value: order.paymentMethod },
              { label: "Product", value: order.product },
              {
                label: "Delivery Date",
                value: order.deliveryDate
                  ? formatDateOnly(order.deliveryDate)
                  : null,
              },
              { label: "Delivered", value: when(order.deliveredAt) },
              { label: "AWB Number", value: order.awbNumber },
              { label: "Courier", value: order.courier },
            ]}
          />
          <DetailSection
            title="Customer"
            fields={[
              { label: "Customer Name", value: order.customerName },
              { label: "Primary Phone", value: order.primaryPhone },
              { label: "City", value: order.city },
              { label: "Country", value: order.country },
            ]}
          />
        </div>
      )}

      <Modal
        open={dialog === "move"}
        onClose={dismiss}
        title={`Update the payment status of order ${label}`}
        size="sm"
        footer={footer("Update status")}
      >
        <div className="flex flex-col gap-4">
          <p className="text-ink-muted">
            Current status:{" "}
            <span className="font-medium text-ink">
              {paymentStatusLabel(record.status)}
            </span>
            .
          </p>
          {statusField(moves)}
          {/* Q16: a payment counts as received only once Accounts has verified it. */}
          {target === "PAYMENT_RECEIVED" && (
            <p className="text-ink-muted">
              Mark it received only once you have verified the payment. Moving
              it back afterwards needs a correction.
            </p>
          )}
          <FormField label="Remarks" hint="Optional" error={fieldError}>
            {(control) => (
              <Textarea
                {...control}
                value={text}
                maxLength={REMARKS_MAX_LENGTH}
                rows={3}
                onChange={(event) => {
                  setText(event.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
              />
            )}
          </FormField>
        </div>
      </Modal>

      <Modal
        open={dialog === "correct"}
        onClose={dismiss}
        title={`Correct the payment status of order ${label}`}
        size="sm"
        footer={footer("Save correction")}
      >
        <div className="flex flex-col gap-4">
          {/* Q14: heads can move a status backward or correct it; the history is kept. */}
          <p className="text-ink-muted">
            A correction can move the status to any other, backwards included.
            The reason is kept in the record’s Journey.
          </p>
          {statusField(corrections)}
          <FormField
            label="Reason for the correction"
            required
            error={fieldError}
          >
            {(control) => (
              <Textarea
                {...control}
                value={text}
                maxLength={CORRECTION_REASON_MAX_LENGTH}
                rows={3}
                onChange={(event) => {
                  setText(event.target.value);
                  if (fieldError) setFieldError(undefined);
                }}
              />
            )}
          </FormField>
        </div>
      </Modal>
    </Drawer>
  );
}
