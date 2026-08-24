"use client";

import { Modal } from "@/components/ui/Modal";
import { Button, type ButtonVariant } from "@/components/ui/Button";
import type { Tone } from "@/types";

/** Button has no warning variant, so a caution confirm reuses the danger affordance. */
const TONE_VARIANT: Record<Tone, ButtonVariant> = {
  brand: "primary",
  neutral: "primary",
  success: "primary",
  info: "primary",
  warning: "danger",
  danger: "danger",
};

export type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmLabel?: string;
  tone?: Tone;
  /**
   * The confirm mutation is running: the confirm button shows the shared loading
   * spinner (and can't be clicked again), Cancel is disabled, and Escape/backdrop/✕
   * are inert so the dialog can't be dismissed mid-mutation. Defaults to false, so
   * every existing close-on-confirm caller is unchanged.
   */
  busy?: boolean;
};

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirm",
  tone = "danger",
  busy = false,
}: ConfirmDialogProps) {
  return (
    <Modal
      open={open}
      onClose={busy ? () => {} : onCancel}
      title={title}
      size="sm"
      footer={
        <>
          <Button variant="secondary" onClick={onCancel} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant={TONE_VARIANT[tone]}
            onClick={onConfirm}
            isLoading={busy}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink-muted">{description}</p>
    </Modal>
  );
}
