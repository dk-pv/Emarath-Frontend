import { LeadsListView } from "@/components/leads/leads-list-view";
import { routeMetadata } from "@/lib/route-metadata";

export const metadata = routeMetadata("/leads");

/** Only a JSON array is handed to the filter builder; anything else in the URL is ignored. */
function conditionsPayload(raw: string | undefined): string | null {
  if (!raw) return null;
  try {
    return Array.isArray(JSON.parse(raw)) ? raw : null;
  } catch {
    return null;
  }
}

/**
 * `?conditions=<json>` pre-applies a whole advanced-filter payload — the Leads By Status
 * report's counts open the list this way in a new tab, carrying every filter the count was
 * computed under so the list shows exactly those leads. `?status=<name>` is the one-condition
 * form. Read on the server and handed down, so no Suspense boundary is needed for
 * `useSearchParams` (the reset-password page's approach).
 */
export default async function LeadsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; conditions?: string }>;
}) {
  const { status, conditions } = await searchParams;
  return (
    <LeadsListView
      initialStatus={status ?? null}
      initialConditions={conditionsPayload(conditions)}
    />
  );
}
