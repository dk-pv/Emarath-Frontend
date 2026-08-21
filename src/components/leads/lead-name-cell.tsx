"use client";

import Link from "next/link";
import { IconArrowUpRight } from "@tabler/icons-react";
import { CustomerNameLink } from "@/components/leads/customer-name-link";
import { useLeadDetail } from "@/components/leads/lead-detail-context";
import type { LeadListItem } from "@/services/leads-service";

/**
 * The Leads table's Customer Name cell. In the Leads list a `LeadDetailProvider`
 * is present, so the two Workpex interactions coexist (traced from the supplied
 * screenshots): clicking the name opens the Lead Detail drawer in place, and a
 * hover-revealed arrow beside it navigates to the full Lead Detail page
 * (`/leads/{id}`) — the drawer is never opened by the arrow, nor the page by the name.
 *
 * Everywhere the provider is absent (the Activities list), it falls back to
 * `CustomerNameLink`, whose whole name already navigates to `/leads/{id}` (ACT-09.1),
 * so no separate arrow is needed there. The underline styling is identical either way.
 */
export function LeadNameCell({ lead }: { lead: LeadListItem }) {
  const detail = useLeadDetail();

  if (!detail) {
    return <CustomerNameLink leadId={lead.id} name={lead.name} />;
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <button
        type="button"
        onClick={() => detail.onOpen(lead)}
        className="focus-ring rounded-sm text-left font-medium text-ink underline decoration-1 underline-offset-2 transition-colors duration-(--duration-shell) ease-shell hover:text-ink-muted"
      >
        {lead.name}
      </button>
      {/* The row is a `group` (the sticky first column), so the arrow rests hidden
          and appears on row hover or keyboard focus — Workpex's open-in-page affordance. */}
      <Link
        href={`/leads/${lead.id}`}
        aria-label={`Open ${lead.name} details page`}
        title="Open details page"
        className="focus-ring flex size-5 shrink-0 items-center justify-center rounded-control border border-hairline text-ink-subtle opacity-0 transition-opacity duration-(--duration-shell) ease-shell group-hover:opacity-100 hover:text-ink focus-visible:opacity-100"
      >
        <IconArrowUpRight size={13} stroke={2} aria-hidden="true" />
      </Link>
    </span>
  );
}
