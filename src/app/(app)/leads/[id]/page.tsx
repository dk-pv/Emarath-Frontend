import { LeadDetailView } from "@/components/leads/lead-detail-view";

export const metadata = { title: "Lead Detail" };

/**
 * The Lead Detail page (`/leads/{id}`) — the destination the Leads list Customer-Name
 * hover arrow and the Activities Customer-Name link (ACT-09.1) open. Renders the
 * Basic Info panel and the Details column (Notes from real data; the remaining
 * sections as honest Workpex empty states) — see `LeadDetailView` and ADR-0037.
 */
export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <LeadDetailView id={id} />;
}
