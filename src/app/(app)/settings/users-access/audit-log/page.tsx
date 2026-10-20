import type { Metadata } from "next";
import { AuditLogView } from "@/components/settings/audit-log/audit-log-view";

export const metadata: Metadata = { title: "Audit Log - Emarath" };

/**
 * Settings → Users & Access → Audit Log (AUD-02): every recorded change, read-only, backed by
 * `GET /api/audit/log` (Super Admin only).
 */
export default function AuditLogPage() {
  return <AuditLogView />;
}
