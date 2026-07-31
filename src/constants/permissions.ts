import type { UserRole } from "./roles";

/**
 * Role-based capabilities (AUTH-02.2). One central map from a capability to the roles that
 * hold it — screens ask `can(role, capability)` and never test a role inline (AC5), so
 * changing who may do something is a one-line edit here, not a hunt across screens.
 *
 * Only capabilities the backlog explicitly confirms are defined:
 *   • reassignLeads / viewTeamMetrics — "only managers and admins see team-wide dashboard
 *     metrics and reassignment tools" (AUTH-02.2 description).
 * Every other role/menu mapping is unresolved (awaiting Product Owner) and deliberately
 * absent, so nothing here restricts a surface the business has not signed off.
 */
export type Capability = "reassignLeads" | "viewTeamMetrics";

const MANAGERS_AND_ADMINS: readonly UserRole[] = [
  "SUPERADMIN",
  "SALES_MANAGER",
];

const CAPABILITY_ROLES: Record<Capability, readonly UserRole[]> = {
  reassignLeads: MANAGERS_AND_ADMINS,
  viewTeamMetrics: MANAGERS_AND_ADMINS,
};

/** True when the role holds the capability. Unknown/absent role holds nothing (fail-closed). */
export function can(
  role: UserRole | null | undefined,
  capability: Capability,
): boolean {
  return role != null && CAPABILITY_ROLES[capability].includes(role);
}
