import { LeadDetailView } from "@/components/leads/lead-detail-view";

export const metadata = { title: "Lead Detail" };

/**
 * The Lead Detail page (Lead-Detail-Blueprint §3) — the destination the Activities
 * Customer-Name link opens. This is the minimum shell: header + Basic Info, with
 * loading and missing/deleted-lead states. The Details column (notes, timeline,
 * attachments, logs) is later, phased work and deliberately absent.
 */
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadDetailView id={id} />;
}
