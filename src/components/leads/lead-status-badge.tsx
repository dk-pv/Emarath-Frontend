import { Tag } from "@/components/ui/Tag";
import type { Tone } from "@/types";

/**
 * Maps known Workpex statuses onto the design-system tones (LEAD-02.2 AC2:
 * status shows as a colour-coded badge).
 *
 * This is intentionally a small, approximate mapping. Workpex assigns each
 * status a specific configurable colour (purple New, cyan NOT ANSWER, pink NOT
 * REACHED …) that our six tones cannot reproduce exactly. Reproducing that
 * palette is LEAD-11.1's dedicated scope; here the badge is colour-coded but not
 * yet pixel-matched, and unmapped statuses fall back to neutral rather than
 * being guessed.
 */
const STATUS_TONE: Record<string, Tone> = {
  won: "success",
  qualified: "success",
  new: "info",
  cold: "info",
  "not answer": "warning",
  warm: "warning",
  hot: "danger",
  "super hot": "danger",
  "not reached": "danger",
  "invalid number": "danger",
};

export function LeadStatusBadge({ status }: { status: string }) {
  const tone = STATUS_TONE[status.toLowerCase()] ?? "neutral";
  return <Tag tone={tone}>{status}</Tag>;
}
