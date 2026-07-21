import { apiGet, apiPut } from "@/lib/api-client";

/** The Manage Columns view key for the Leads table (LEAD-05.1). */
export const LEADS_VIEW_KEY = "leads";

/**
 * A saved table layout: the manageable column ids in the user's chosen order, and
 * the subset currently hidden. Mirrors the backend contract; a shared/generated
 * API type replaces this hand-written mirror later, like the other services here.
 */
export interface ColumnLayout {
  order: string[];
  hidden: string[];
}

/** Fetches the caller's saved layout for a view (LEAD-05.1 AC3), or null if none. */
export async function fetchColumnLayout(
  viewKey: string,
  signal?: AbortSignal,
): Promise<ColumnLayout | null> {
  const { layout } = await apiGet<{ layout: ColumnLayout | null }>(
    `/view-preferences/${viewKey}`,
    undefined,
    signal,
  );
  return layout;
}

/** Saves the caller's layout for a view — called when Manage Columns is submitted. */
export async function saveColumnLayout(
  viewKey: string,
  layout: ColumnLayout,
  signal?: AbortSignal,
): Promise<ColumnLayout> {
  const { layout: saved } = await apiPut<{ layout: ColumnLayout }>(
    `/view-preferences/${viewKey}`,
    layout,
    signal,
  );
  return saved;
}

/**
 * Reconciles a saved layout against the columns that exist now.
 *
 * The saved order is honoured; a key no longer present (a column removed or
 * renamed since it was saved) is dropped; and a column that did not exist when the
 * layout was saved is appended, so a newly added column always appears rather than
 * vanishing because an old layout never mentioned it. With no saved layout the
 * default is every column, in the given order, nothing hidden.
 */
export function reconcileLayout(
  saved: ColumnLayout | null,
  knownKeys: readonly string[],
): ColumnLayout {
  if (!saved) return { order: [...knownKeys], hidden: [] };

  const known = new Set(knownKeys);
  const savedOrder = saved.order.filter((key) => known.has(key));
  const appended = knownKeys.filter((key) => !savedOrder.includes(key));

  return {
    order: [...savedOrder, ...appended],
    hidden: saved.hidden.filter((key) => known.has(key)),
  };
}
