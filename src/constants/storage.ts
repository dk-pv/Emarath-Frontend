/** localStorage keys. Namespaced so they never collide with another app on the origin. */
const NS = "emarath";

export const SIDEBAR_COLLAPSED_KEY = `${NS}:sidebar-collapsed`;

/** Column visibility/order is remembered per module (FND-03.1 AC4). */
export const columnPrefsKey = (moduleId: string) => `${NS}:columns:${moduleId}`;
