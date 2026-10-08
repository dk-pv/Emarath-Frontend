/** Workpex opens every list at 100 rows per page — `leads-manage-columns-drawer-open.png`. */
export const DEFAULT_PAGE_SIZE = 100;

export const PAGE_SIZE_OPTIONS: readonly number[] = [10, 25, 50, 100];

/** A pause after the last keystroke before a list's server search runs. */
export const SEARCH_DEBOUNCE_MS = 300;

/**
 * The longest search term the Leads, Kanban and Activities APIs accept (their
 * MAX_SEARCH_LENGTH). A longer one is refused with a 400, which would blank the list into
 * its error state, so the box stops there instead.
 */
export const SEARCH_MAX_LENGTH = 200;
