import { Tag } from "@/components/ui/Tag";
import { paymentStatusLabel, type PaymentStatus } from "@/lib/accounts-records";
import type { Tone } from "@/types";

/**
 * Tint only — the label always carries the meaning. Shared with the count cards, so one status
 * reads in one colour across the screen.
 */
export const PAYMENT_STATUS_TONE: Record<PaymentStatus, Tone> = {
  INITIAL: "neutral",
  PAYMENT_PENDING: "warning",
  PAYMENT_RECEIVED: "success",
  PAYMENT_FAILED: "danger",
  PARTIALLY_PAID: "info",
};

/** A record's payment status, as the shared `Tag` pill. An unknown status reads neutral. */
export function PaymentStatusBadge({ status }: { status: string }) {
  return (
    <Tag tone={PAYMENT_STATUS_TONE[status as PaymentStatus] ?? "neutral"}>
      {paymentStatusLabel(status)}
    </Tag>
  );
}
