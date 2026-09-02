import { apiGet, apiPut } from "@/lib/api-client";

/** The Manage Columns view key for the Leads table (LEAD-05.1). */
export const LEADS_VIEW_KEY = "leads";

/** The Manage Columns view key for the Activities table (ACT-07.1). */
export const ACTIVITIES_VIEW_KEY = "activities";

/** The Manage Columns view key for the Recent Call Log (CALL-05.2). */
export const CALLS_VIEW_KEY = "calls";

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
 * The Kanban stage-pin preference (KAN-05.2): a per-pipeline map of the one pinned
 * (sticky/frozen) stage. Stored per-user, reusing the view-preferences store — one
 * user's pins never affect another's board.
 */
export interface KanbanPins {
  pins: Record<string, string>;
}

/** Fetches the caller's Kanban stage pins (per-pipeline → pinned stage name). */
export function fetchKanbanPins(signal?: AbortSignal): Promise<KanbanPins> {
  return apiGet<KanbanPins>("/view-preferences/kanban-pins", undefined, signal);
}

/**
 * Pins a stage in a pipeline (replacing any previous pin there), or unpins the
 * pipeline when `stage` is null. Returns the updated map.
 */
export function saveKanbanPin(
  pipeline: string,
  stage: string | null,
  signal?: AbortSignal,
): Promise<KanbanPins> {
  return apiPut<KanbanPins>(
    "/view-preferences/kanban-pins",
    stage === null ? { pipeline } : { pipeline, stage },
    signal,
  );
}

/** The Lead Aging report's banding thresholds, in days (RPT-02.8). */
export interface AgingThresholds {
  green: number;
  amber: number;
}

/** The Lead First Response report's settings (RPT-02.9). */
export interface FirstResponseSettings {
  lateHours: number;
}

/** The caller's saved First Response settings, or the report's default. */
export function fetchFirstResponseSettings(
  signal?: AbortSignal,
): Promise<FirstResponseSettings> {
  return apiGet<FirstResponseSettings>(
    "/view-preferences/lead-first-response-settings",
    undefined,
    signal,
  );
}

/** Saves the caller's First Response settings; returns what the server stored. */
export function saveFirstResponseSettings(
  settings: FirstResponseSettings,
  signal?: AbortSignal,
): Promise<FirstResponseSettings> {
  return apiPut<FirstResponseSettings>(
    "/view-preferences/lead-first-response-settings",
    settings,
    signal,
  );
}

/** The caller's saved aging thresholds, or the report's defaults. */
export function fetchAgingThresholds(
  signal?: AbortSignal,
): Promise<AgingThresholds> {
  return apiGet<AgingThresholds>(
    "/view-preferences/lead-aging-thresholds",
    undefined,
    signal,
  );
}

/** Saves the caller's aging thresholds; returns what the server stored. */
export function saveAgingThresholds(
  thresholds: AgingThresholds,
  signal?: AbortSignal,
): Promise<AgingThresholds> {
  return apiPut<AgingThresholds>(
    "/view-preferences/lead-aging-thresholds",
    thresholds,
    signal,
  );
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
  /**
   * Keys that start hidden when the user has no saved layout, and that stay hidden
   * when they are added to a module after one was saved. Activities offers its
   * linked lead's fields as optional columns, so its default worklist shows only
   * the five Workpex opens with; a module that wants everything visible — Leads —
   * simply omits this.
   */
  defaultHidden: readonly string[] = [],
): ColumnLayout {
  if (!saved) {
    return { order: [...knownKeys], hidden: [...defaultHidden] };
  }

  const known = new Set(knownKeys);
  const savedOrder = saved.order.filter((key) => known.has(key));
  const appended = knownKeys.filter((key) => !savedOrder.includes(key));

  // A key the saved layout never knew about is new to the module: honour its
  // default rather than silently revealing it in every existing user's table.
  const unseenHidden = appended.filter((key) => defaultHidden.includes(key));

  return {
    order: [...savedOrder, ...appended],
    hidden: [...saved.hidden.filter((key) => known.has(key)), ...unseenHidden],
  };
}
