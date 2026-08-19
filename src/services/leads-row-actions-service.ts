import { apiDelete, apiPost } from "@/lib/api-client";
import type { LeadListItem } from "@/services/leads-service";

/**
 * Single-lead row quick actions (LEAD-10.2), wired to the LEAD-10.1 API.
 *
 * WhatsApp and email are not here: WhatsApp is a `wa.me` deep-link built on the
 * client and email is disabled (leads carry no email address), so neither hits
 * the server — see `lead-row-actions.tsx` and ADR-0013. Duplicate has no Workpex
 * control, so it is absent; status is the inline dropdown captured in
 * `lead-status.mp4` (LEAD-11.1), wired below.
 */

/** Set one lead's status inline (LEAD-11.1 dropdown) — returns the updated lead. */
export function setLeadStatus(
  id: string,
  status: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPost<LeadListItem>(`/leads/${id}/status`, { status }, signal);
}

/** Reassign one lead to a single agent — returns the updated lead. */
export function reassignLead(
  id: string,
  agentId: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPost<LeadListItem>(`/leads/${id}/reassign`, { agentId }, signal);
}

/** Permanently delete one lead — returns the removed id. */
export function deleteLead(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/leads/${id}`, signal);
}

/**
 * Pin one lead for the current user (ADR-0031) — returns the lead pinned. The
 * server resolves the caller, so no user id is sent; the list then floats it to
 * the top on the next fetch.
 */
export function pinLead(
  id: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiPost<LeadListItem>(`/leads/${id}/pin`, {}, signal);
}

/** Unpin one lead for the current user — returns the lead unpinned. */
export function unpinLead(
  id: string,
  signal?: AbortSignal,
): Promise<LeadListItem> {
  return apiDelete<LeadListItem>(`/leads/${id}/pin`, signal);
}

/** The Lead Email composer's payload (ADR-0032). From is server-side, never sent. */
export interface SendLeadEmailInput {
  to: string[];
  cc?: string[];
  bcc?: string[];
  subject?: string;
  message?: string;
}

/**
 * Send an email from a lead's row (LEAD-10.2, ADR-0032). The real send happens on
 * the backend through the configured mail transport; this never opens a mail client.
 */
export function sendLeadEmail(
  id: string,
  input: SendLeadEmailInput,
  signal?: AbortSignal,
): Promise<{ sent: boolean }> {
  return apiPost<{ sent: boolean }>(`/leads/${id}/email`, input, signal);
}
