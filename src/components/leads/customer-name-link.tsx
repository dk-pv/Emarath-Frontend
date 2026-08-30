/**
 * A reusable Customer-Name cell that navigates to the Lead Detail page
 * (`/leads/{leadId}`) using Next.js `<Link>`, matching Workpex's behaviour
 * verified by CustomerName-Click.mp4 (ACT-09.1).
 *
 * Using `<Link>` (not `router.push`) means:
 *   - Browser history is preserved — the user can press Back to return.
 *   - The Activities (or Leads) list URL, including its filter and pagination
 *     state, stays in history so Back restores it automatically.
 *   - Missing or deleted leads are handled gracefully by the existing
 *     `LeadDetailView` not-found state.
 *
 * The component is deliberately presentation-only: it owns only the underlined
 * link appearance and the `/leads/{id}` destination. All data concerns stay in
 * the calling column renderer.
 */
import Link from "next/link";

interface CustomerNameLinkProps {
  leadId: string;
  name: string;
  /**
   * The screen the link was clicked from, carried as `?from=…`. The Lead Detail page
   * uses it to vary what it shows per origin — Today Leads hides the Tags section —
   * without every caller needing a different destination.
   */
  from?: string;
}

export function CustomerNameLink({
  leadId,
  name,
  from,
}: CustomerNameLinkProps) {
  return (
    <Link
      href={from ? `/leads/${leadId}?from=${from}` : `/leads/${leadId}`}
      className="font-medium text-ink underline decoration-1 underline-offset-2 hover:text-ink-muted focus-ring rounded-sm transition-colors duration-(--duration-shell) ease-shell"
    >
      {name}
    </Link>
  );
}
