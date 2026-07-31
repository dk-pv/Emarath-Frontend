/**
 * The backend `UserRole` enum, mirrored for the client (AUTH-02.2). The frontend has no
 * generated Prisma client, so the union is declared here and kept in step with
 * emarath-backend's UserRole. It types the signed-in user's role and feeds the permission
 * helper.
 */
export const USER_ROLES = [
  "SUPERADMIN",
  "SALES_MANAGER",
  "SALES_AGENT",
  "CUSTOMER_SERVICE_AGENT",
  "MARKETING_ANALYST",
] as const;

export type UserRole = (typeof USER_ROLES)[number];
