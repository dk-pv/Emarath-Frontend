import { Tag } from "@/components/ui/Tag";
import {
  DELIVERY_BUCKET_LABEL,
  formatDateOnly,
  type DeliveryBucket,
} from "@/lib/logistics-orders";
import type { Tone } from "@/types";

/** Tint only — the label carries the meaning. Overdue is the one that needs acting on. */
const BUCKET_TONE: Record<DeliveryBucket, Tone> = {
  today: "warning",
  tomorrow: "info",
  future: "neutral",
  overdue: "danger",
  none: "neutral",
};

/**
 * An order's delivery date and where it stands on the business day (ADR-0094) — the bucket the
 * backend worked out, so no browser clock decides it. An undated order reads "No Delivery Date";
 * a past date whose delivery already has an outcome shows the date alone.
 */
export function LogisticsDeliveryDate({
  date,
  bucket,
}: {
  date: string | null;
  bucket: DeliveryBucket | null;
}) {
  if (!date) {
    return <span className="text-ink-muted">{DELIVERY_BUCKET_LABEL.none}</span>;
  }
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5">
      <span className="text-ink">{formatDateOnly(date)}</span>
      {bucket && bucket !== "none" && (
        <Tag tone={BUCKET_TONE[bucket]}>{DELIVERY_BUCKET_LABEL[bucket]}</Tag>
      )}
    </span>
  );
}
