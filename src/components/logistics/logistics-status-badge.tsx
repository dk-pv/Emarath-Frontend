import { Tag } from "@/components/ui/Tag";
import {
  logisticsStatusLabel,
  type LogisticsStatus,
} from "@/lib/logistics-orders";
import type { Tone } from "@/types";

/**
 * Tint only — the label always carries the meaning, so the tone never has to. Shared with the
 * Pipeline columns and the count cards, so one status reads in one colour across the screen.
 */
export const LOGISTICS_STATUS_TONE: Record<LogisticsStatus, Tone> = {
  INITIAL: "neutral",
  QC_VERIFIED: "info",
  QC_REJECTED: "warning",
  DISPATCHED: "brand",
  DELIVERED: "success",
  CANCELLED: "danger",
  RTO: "warning",
};

/** An order's current status, as the shared `Tag` pill. An unknown status reads neutral. */
export function LogisticsStatusBadge({ status }: { status: string }) {
  return (
    <Tag tone={LOGISTICS_STATUS_TONE[status as LogisticsStatus] ?? "neutral"}>
      {logisticsStatusLabel(status)}
    </Tag>
  );
}
