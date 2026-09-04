import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";
import type { UserRole } from "@/services/users-service";

/**
 * One role in the hierarchy, exactly as `GET /api/roles` returns it.
 *
 * `level`, `assignedCount` and `hasChildren` are all computed server-side: the level
 * decides the row's colour band, and the badge is a real count of live team members, so
 * neither is derived (or invented) in the browser.
 */
export interface RoleNode {
  id: string;
  name: string;
  baseRole: UserRole;
  parentId: string | null;
  position: number;
  level: number;
  assignedCount: number;
  hasChildren: boolean;
  createdByName: string | null;
  createdAt: string;
}

export interface CreateRoleInput {
  name: string;
  baseRole: UserRole;
  parentId?: string;
}

export interface UpdateRoleInput {
  name?: string;
  baseRole?: UserRole;
  /** `null` promotes the role to a root; omit the key to leave the parent untouched. */
  parentId?: string | null;
}

export function fetchRoles(signal?: AbortSignal): Promise<RoleNode[]> {
  return apiGet<RoleNode[]>("/roles", undefined, signal);
}

export function createRole(input: CreateRoleInput): Promise<RoleNode> {
  return apiPost<RoleNode>("/roles", input);
}

export function updateRole(
  id: string,
  input: UpdateRoleInput,
): Promise<RoleNode> {
  return apiPatch<RoleNode>(`/roles/${id}`, input);
}

/**
 * Where a drag ended. The API answers with the whole tree because one move renumbers
 * every sibling, so anything narrower would leave the page holding stale positions.
 */
export function moveRole(
  id: string,
  input: { parentId?: string | null; position: number },
): Promise<RoleNode[]> {
  return apiPatch<RoleNode[]>(`/roles/${id}/move`, input);
}

export function deleteRole(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/roles/${id}`);
}

/** A role plus its children, for rendering the indented tree. */
export interface RoleTreeNode extends RoleNode {
  children: RoleTreeNode[];
}

/**
 * Nests the flat API rows.
 *
 * Rows whose parent is missing from the payload are treated as roots rather than dropped —
 * a role must never vanish from an administration screen because of an unexpected shape.
 */
export function buildRoleTree(rows: RoleNode[]): RoleTreeNode[] {
  const byId = new Map<string, RoleTreeNode>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  );
  const roots: RoleTreeNode[] = [];

  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortByPosition = (nodes: RoleTreeNode[]) => {
    nodes.sort((a, b) => a.position - b.position || a.name.localeCompare(b.name));
    nodes.forEach((node) => sortByPosition(node.children));
  };
  sortByPosition(roots);

  return roots;
}
