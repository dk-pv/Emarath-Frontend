import { apiGet } from "@/lib/api-client";
import {
  AUDIT_LOG_FILTER_OPTIONS_PATH,
  AUDIT_LOG_PATH,
  auditLogParams,
  type AuditLogFilterOptions,
  type AuditLogFilters,
  type AuditLogRow,
} from "@/lib/audit-log";
import type { ListResult } from "@/types";

/** One page of the administrator's audit log (AUD-02), newest first. Super Admin only. */
export function fetchAuditLog(
  filters: AuditLogFilters,
  page: number,
  size: number,
  signal?: AbortSignal,
): Promise<ListResult<AuditLogRow>> {
  return apiGet<ListResult<AuditLogRow>>(
    AUDIT_LOG_PATH,
    auditLogParams(filters, page, size),
    signal,
  );
}

/** The record types and the people the filters offer. */
export function fetchAuditLogFilterOptions(
  signal?: AbortSignal,
): Promise<AuditLogFilterOptions> {
  return apiGet<AuditLogFilterOptions>(
    AUDIT_LOG_FILTER_OPTIONS_PATH,
    undefined,
    signal,
  );
}
