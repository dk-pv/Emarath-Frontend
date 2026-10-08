import type { UserRole } from "./roles";

/**
 * Role-based capabilities (AUTH-02.2). One central map from a capability to the roles that
 * hold it — screens ask `can(role, capability)` and never test a role inline (AC5), so
 * changing who may do something is a one-line edit here, not a hunt across screens.
 *
 * Only capabilities the backlog or the client CRM specification (CLAUDE.md §1A) explicitly
 * confirms are defined:
 *   • reassignLeads / viewTeamMetrics — "only managers and admins see team-wide dashboard
 *     metrics and reassignment tools" (AUTH-02.2 description).
 *   • useSalesModules — the sales modules belong to the five sales roles; the post-sale
 *     roles (Logistics, QC, Accounts) hold no sales access, and the backend refuses them
 *     (ADR-0084). Hiding here only spares them screens that would answer 403.
 *   • useLogistics — the order queue: the Logistics roles and QC work every order and the
 *     sales roles read their own converted leads' (client clarifications 2026-09-23 CD-8/CD-10
 *     and 2026-10-01 Q1).
 *     It mirrors the backend's LOGISTICS_READ_ROLES, which is what actually enforces it;
 *     Accounts is refused there until its own phase.
 *   • manageStages — add, rename, recolour, reorder and delete pipeline stages: admins and
 *     sales managers only (owner decision 2026-10-07, KAN-05.2 AC5). Mirrors the
 *     backend's @Roles on the stage writes, which is what actually enforces it.
 * Every other role/menu mapping is unresolved (awaiting Product Owner) and deliberately
 * absent, so nothing here restricts a surface the business has not signed off.
 */
export type Capability =
  | "reassignLeads"
  | "viewTeamMetrics"
  | "useSalesModules"
  | "useLogistics"
  | "manageStages";

const MANAGERS_AND_ADMINS: readonly UserRole[] = [
  "SUPERADMIN",
  "SALES_MANAGER",
];

const SALES_ROLES: readonly UserRole[] = [
  "SUPERADMIN",
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
];

const CAPABILITY_ROLES: Record<Capability, readonly UserRole[]> = {
  reassignLeads: MANAGERS_AND_ADMINS,
  viewTeamMetrics: MANAGERS_AND_ADMINS,
  manageStages: MANAGERS_AND_ADMINS,
  useSalesModules: SALES_ROLES,
  useLogistics: [
    ...SALES_ROLES,
    "LOGISTICS_MANAGER",
    "LOGISTICS_EXECUTIVE",
    "QC",
  ],
};

/** True when the role holds the capability. Unknown/absent role holds nothing (fail-closed). */
export function can(
  role: UserRole | null | undefined,
  capability: Capability,
): boolean {
  return role != null && CAPABILITY_ROLES[capability].includes(role);
}
