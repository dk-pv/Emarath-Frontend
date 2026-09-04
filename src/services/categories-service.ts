import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * One category as `GET /api/categories` returns it.
 *
 * `level`, `hasChildren` and `leadCount` are computed server-side. `leadCount` is the
 * live-lead count carrying this category's name — the number the delete dialog explains a
 * refusal with, and the reason the client never has to guess whether a delete will work.
 */
export interface CategoryNode {
  id: string;
  name: string;
  parentId: string | null;
  position: number;
  level: number;
  isActive: boolean;
  hasChildren: boolean;
  leadCount: number;
  createdByName: string | null;
  createdAt: string;
}

export interface CreateCategoryInput {
  name: string;
  parentId?: string;
  isActive?: boolean;
}

export interface UpdateCategoryInput {
  name?: string;
  isActive?: boolean;
  /** `null` promotes to a root; omit the key to leave the parent untouched. */
  parentId?: string | null;
}

export function fetchCategories(
  signal?: AbortSignal,
): Promise<CategoryNode[]> {
  return apiGet<CategoryNode[]>("/categories", undefined, signal);
}

export function createCategory(
  input: CreateCategoryInput,
): Promise<CategoryNode> {
  return apiPost<CategoryNode>("/categories", input);
}

export function updateCategory(
  id: string,
  input: UpdateCategoryInput,
): Promise<CategoryNode> {
  return apiPatch<CategoryNode>(`/categories/${id}`, input);
}

/**
 * Where a drag ended. The API answers with the whole tree because one move renumbers every
 * sibling, so anything narrower would leave the page holding stale positions.
 */
export function moveCategory(
  id: string,
  input: { parentId?: string | null; position: number },
): Promise<CategoryNode[]> {
  return apiPatch<CategoryNode[]>(`/categories/${id}/move`, input);
}

export function deleteCategory(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/categories/${id}`);
}

/** A category plus its children, for rendering the indented tree. */
export interface CategoryTreeNode extends CategoryNode {
  children: CategoryTreeNode[];
}

/**
 * Nests the flat API rows.
 *
 * Rows whose parent is missing from the payload become roots rather than being dropped — a
 * category must never vanish from its own management screen because of an unexpected shape.
 */
export function buildCategoryTree(rows: CategoryNode[]): CategoryTreeNode[] {
  const byId = new Map<string, CategoryTreeNode>(
    rows.map((row) => [row.id, { ...row, children: [] }]),
  );
  const roots: CategoryTreeNode[] = [];

  for (const row of rows) {
    const node = byId.get(row.id);
    if (!node) continue;
    const parent = row.parentId ? byId.get(row.parentId) : undefined;
    if (parent) parent.children.push(node);
    else roots.push(node);
  }

  const sortByPosition = (nodes: CategoryTreeNode[]) => {
    nodes.sort(
      (a, b) => a.position - b.position || a.name.localeCompare(b.name),
    );
    nodes.forEach((node) => sortByPosition(node.children));
  };
  sortByPosition(roots);

  return roots;
}
