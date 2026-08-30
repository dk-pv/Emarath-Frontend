import { LeadsListView } from "@/components/leads/leads-list-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/leads");

/**
 * `?status=<name>` pre-applies a Lead Status filter — the Leads By Status report's counts
 * open the list this way in a new tab. Read on the server and handed down, so no Suspense
 * boundary is needed for `useSearchParams` (the reset-password page's approach).
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  return <LeadsListView initialStatus={status ?? null} />;
}
