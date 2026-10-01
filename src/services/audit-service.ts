import { apiGet } from "@/lib/api-client";
import {
  AUDIT_EVENTS_PATH,
  auditEventsParams,
  type AuditEvent,
} from "@/lib/audit-journey";
import type { ListResult } from "@/types";

export type { AuditEvent };

/** One page of `GET /audit/events`: the rows plus the journey's total, like every list here. */
export type AuditEventResponse = ListResult<AuditEvent>;

/**
 * One page of a lead's customer journey (ADR-0083), oldest first. Scoped server-side: a lead
 * the caller cannot see is a 404, and a Logistics user receives only its order's events — the
 * caller renders whatever comes back and never asks for anything the API did not grant.
 */
export function fetchLeadAuditEvents(
  leadId: string,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<AuditEventResponse> {
  return apiGet<AuditEventResponse>(
    AUDIT_EVENTS_PATH,
    auditEventsParams(leadId, page, size),
    signal,
  );
}
