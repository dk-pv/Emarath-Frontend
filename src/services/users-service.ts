import {
  apiDelete,
  apiGet,
  apiPatch,
  apiPost,
  apiPostForm,
} from "@/lib/api-client";
import type { ListQuery, ListResult } from "@/types";

/** The seeded auth-role set (AUTH-01.1). Mirrors the backend `UserRole` enum. */
export type UserRole =
  | "SUPERADMIN"
  | "SALES_MANAGER"
  | "SALES_AGENT"
  | "CUSTOMER_SERVICE_AGENT"
  | "MARKETING_ANALYST";

/** Enum value → fallback label, for accounts that predate the named-role table. */
export const USER_ROLE_LABELS: Record<UserRole, string> = {
  SUPERADMIN: "Account Holder",
  SALES_MANAGER: "Sales Manager",
  SALES_AGENT: "Sales Agent",
  CUSTOMER_SERVICE_AGENT: "Customer Service",
  MARKETING_ANALYST: "Marketing Analyst",
};

export function userRoleLabel(role: string): string {
  return USER_ROLE_LABELS[role as UserRole] ?? role;
}

/** A named organisational role (ADR-0055): what the wizard's Role dropdown lists. */
export interface NamedRole {
  id: string;
  name: string;
  baseRole: UserRole;
}

/** A lead form the wizard's "Assign Lead Form" offers. */
export interface LeadFormOption {
  id: string;
  name: string;
}

export type WhatsappAccessLevel = "RESTRICTED" | "FULL";

export const WHATSAPP_ACCESS_OPTIONS: {
  value: WhatsappAccessLevel;
  label: string;
}[] = [
  { value: "RESTRICTED", label: "Restricted" },
  { value: "FULL", label: "Full Access" },
];

/** One matrix row's applicability, from GET /api/users/permission-catalog. */
export interface PermissionCatalogRow {
  module: string;
  label: string;
  view: boolean;
  add: boolean;
  edit: boolean;
}

/** One matrix row's state, as stored/submitted. */
export interface PermissionEntry {
  module: string;
  canView?: boolean;
  canAdd?: boolean;
  canEdit?: boolean;
}

/**
 * One team member as `GET /api/users` returns it, mirroring the backend `UserResponse`.
 * There is no password field of any kind: the backend selects columns explicitly, so
 * the hash cannot reach this shape.
 */
export interface TeamMember {
  id: string;
  name: string;
  firstName: string | null;
  lastName: string | null;
  email: string;
  username: string;
  role: UserRole;
  roleId: string | null;
  roleName: string | null;
  /** Who this member reports to — the roster's org tree; null at the top of a branch. */
  reportingToId: string | null;
  jobTitle: string | null;
  phone: string | null;
  team: string | null;
  isActive: boolean;
  colorCode: string | null;
  avatarUrl: string | null;
  lastLoginAt: string | null;
  lastSeenAt: string | null;
  createdAt: string;
}

/** The full wizard configuration (GET /api/users/:id), for the edit drawer. */
export interface TeamMemberDetail extends TeamMember {
  reportingToName: string | null;
  leadFormId: string | null;
  pipelines: string[];
  appAccess: boolean;
  trackCheckInOut: boolean;
  trackMeetingLocation: boolean;
  includeInReporting: boolean;
  autoFollowUpPrompt: boolean;
  whatsappInboxAccess: WhatsappAccessLevel | null;
  monthlyGoalAmount: string | null;
  permissions: PermissionEntry[];
}

export type TeamMemberListOptions = {
  /** The Role dropdown; `null` is "every role". */
  role?: UserRole | null;
};

/** One page of the roster. Search, role filter, sort and paging are all server-side. */
export function fetchTeamMembers(
  query: ListQuery,
  options?: TeamMemberListOptions,
  signal?: AbortSignal,
): Promise<ListResult<TeamMember>> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.sort) {
    params.set("sort", query.sort.key);
    params.set("direction", query.sort.direction);
  }
  if (query.search) params.set("search", query.search);
  if (options?.role) params.set("role", options.role);
  return apiGet<ListResult<TeamMember>>("/users", params, signal);
}

export function fetchTeamMemberDetail(
  id: string,
  signal?: AbortSignal,
): Promise<TeamMemberDetail> {
  return apiGet<TeamMemberDetail>(`/users/${id}`, undefined, signal);
}

/** The wizard's Role dropdown options — the named roles, not the raw enum. */
export function fetchNamedRoles(signal?: AbortSignal): Promise<NamedRole[]> {
  return apiGet<NamedRole[]>("/users/roles", undefined, signal);
}

export function fetchLeadForms(
  signal?: AbortSignal,
): Promise<LeadFormOption[]> {
  return apiGet<LeadFormOption[]>("/users/lead-forms", undefined, signal);
}

export function fetchPermissionCatalog(
  signal?: AbortSignal,
): Promise<PermissionCatalogRow[]> {
  return apiGet<PermissionCatalogRow[]>(
    "/users/permission-catalog",
    undefined,
    signal,
  );
}

/** The wizard fields shared by create and edit. */
export type TeamMemberConfigInput = {
  jobTitle?: string | null;
  roleId?: string;
  reportingToId?: string | null;
  leadFormId?: string | null;
  pipelines?: string[];
  isActive?: boolean;
  appAccess?: boolean;
  trackCheckInOut?: boolean;
  trackMeetingLocation?: boolean;
  includeInReporting?: boolean;
  autoFollowUpPrompt?: boolean;
  whatsappInboxAccess?: WhatsappAccessLevel | null;
  colorCode?: string | null;
  monthlyGoalAmount?: number | null;
  permissions?: PermissionEntry[];
};

export type CreateTeamMemberInput = TeamMemberConfigInput & {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  password: string;
  roleId: string;
};

export function createTeamMember(
  input: CreateTeamMemberInput,
): Promise<TeamMemberDetail> {
  return apiPost<TeamMemberDetail>("/users", input);
}

export type UpdateTeamMemberInput = TeamMemberConfigInput & {
  firstName?: string;
  lastName?: string;
  email?: string;
  phone?: string | null;
};

export function updateTeamMember(
  id: string,
  input: UpdateTeamMemberInput,
): Promise<TeamMemberDetail> {
  return apiPatch<TeamMemberDetail>(`/users/${id}`, input);
}

/** Stores the profile picture (PNG/JPG ≤ 5MB); returns the new signed URL. */
export function uploadTeamMemberAvatar(
  id: string,
  file: File,
): Promise<{ id: string; avatarUrl: string }> {
  const form = new FormData();
  form.append("file", file);
  return apiPostForm<{ id: string; avatarUrl: string }>(
    `/users/${id}/avatar`,
    form,
  );
}

/**
 * Sets a team member's password. The new value is sent once and never read back — no
 * endpoint returns a password or its hash.
 */
export function setTeamMemberPassword(
  id: string,
  password: string,
): Promise<{ id: string }> {
  return apiPatch<{ id: string }>(`/users/${id}/password`, { password });
}

export function deleteTeamMember(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/users/${id}`);
}
