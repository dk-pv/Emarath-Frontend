import { dayBoundaries } from "@/lib/day-boundaries";
import type { FilterCondition } from "@/types";

/**
 * The Quick Filter presets, in the order Workpex lists them (LEAD-04.1), read from
 * `ui-reference/leads/Quick-Filter.mp4` and the two dropdown captures, plus the PO's
 * 27-08-2026 capture that adds This Month / Last Month (see the note on the list below).
 *
 * The three activity-driven presets (Today's Follow Ups, Overdue, No Activity)
 * resolve against the lead's activities using the Activities module's own bucket
 * predicate (`activityBucketWhere`), so they mean exactly what the worklist means.
 * `Expired Leads` stays `enabled: false`: its semantics are defined by neither the
 * backlog nor the Workpex reference, so it is shown (to match the menu) but inert
 * pending a definition. Every enabled preset resolves to conditions the existing
 * Leads list pipeline already carries; no new filter builder is introduced.
 */
export interface QuickPreset {
  id: string;
  label: string;
  enabled: boolean;
}

export const QUICK_PRESETS: readonly QuickPreset[] = [
  { id: "today", label: "Today", enabled: true },
  { id: "thisWeek", label: "This Week", enabled: true },
  { id: "lastWeek", label: "Last Week", enabled: true },
  // This Month / Last Month are absent from the two stored captures
  // (`leads-quick-filter-dropdown-open.png`, `kanban-quick-filter-dropdown-open-columns-8-13.png`,
  // both 16-07-2026, which run Last Week straight into Archived) and present in the
  // PO's 27-08-2026 capture of the same menu. The newer capture wins on the PO's
  // instruction; they are the same createdAt window the week presets use.
  { id: "thisMonth", label: "This Month", enabled: true },
  { id: "lastMonth", label: "Last Month", enabled: true },
  { id: "archived", label: "Archived", enabled: true },
  { id: "converted", label: "Converted Leads", enabled: true },
  { id: "todaysFollowUps", label: "Today's Follow Ups", enabled: true },
  { id: "noActivity", label: "No Activity Leads", enabled: true },
  { id: "overdue", label: "Overdue Lead", enabled: true },
  { id: "newLeads", label: "New Leads", enabled: true },
  { id: "expired", label: "Expired Leads", enabled: false },
  { id: "unassigned", label: "Unassigned", enabled: true },
];

/** Why a disabled preset is unavailable — surfaced as the menu item's tooltip. */
export const DISABLED_PRESET_HINT =
  "Unavailable — this filter isn’t defined in the Workpex reference yet";

/**
 * Workpex's Quick Filter menu geometry, shared by the Leads control and the board's
 * Dropdown so the two can never drift. Measured off
 * `leads-quick-filter-dropdown-open.png` and
 * `kanban-quick-filter-dropdown-open-columns-8-13.png`, which agree exactly: rows on a
 * 35px pitch, and a 245px box that scrolls past roughly six and a half items rather
 * than growing to the full list. `py-1.5` against the 15px label is that 35px row.
 *
 * Quick-Filter-only on purpose: the shared Dropdown's own item padding is unchanged,
 * so the Sort, pipeline, user, reports, documents and GPS menus keep their spacing.
 */
export const QUICK_MENU_PANEL_CLASS =
  "scrollbar-slim max-h-[245px] overflow-y-auto";
export const QUICK_MENU_ITEM_CLASS = "py-1.5";

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

/** Monday-start week, matching business-week conventions. */
const startOfWeek = (date: Date): Date => {
  const day = startOfDay(date);
  const offset = (day.getDay() + 6) % 7; // 0 = Monday
  return addDays(day, -offset);
};

const startOfMonth = (date: Date): Date => {
  const day = startOfDay(date);
  day.setDate(1);
  return day;
};

/** Safe because it is only ever called on the 1st — no end-of-month clamping. */
const addMonths = (date: Date, months: number): Date => {
  const copy = new Date(date);
  copy.setMonth(copy.getMonth() + months);
  return copy;
};

/** A half-open [from, to) createdAt window as list conditions. */
const window = (from: Date, to: Date): FilterCondition[] => [
  { key: "createdFrom", value: from.toISOString() },
  { key: "createdTo", value: to.toISOString() },
];

/**
 * The list conditions a preset applies. Date windows are computed now, in the
 * caller's timezone, so "Today"/"This Week"/"Last Week" mean the user's calendar.
 * Called from an event handler, never during render.
 */
export function presetConditions(id: string): FilterCondition[] {
  const now = new Date();
  switch (id) {
    case "today": {
      const from = startOfDay(now);
      return window(from, addDays(from, 1));
    }
    case "thisWeek": {
      const from = startOfWeek(now);
      return window(from, addDays(from, 7));
    }
    case "lastWeek": {
      const thisWeek = startOfWeek(now);
      return window(addDays(thisWeek, -7), thisWeek);
    }
    case "thisMonth": {
      const from = startOfMonth(now);
      return window(from, addMonths(from, 1));
    }
    case "lastMonth": {
      const thisMonth = startOfMonth(now);
      return window(addMonths(thisMonth, -1), thisMonth);
    }
    case "archived":
      return [{ key: "archived", value: "true" }];
    case "unassigned":
      return [{ key: "unassigned", value: "true" }];
    case "converted":
      return [{ key: "status", value: ["WON"] }];
    case "newLeads":
      return [{ key: "status", value: ["New"] }];
    // Activity presets (LEAD-04.1). The flag selects the Activities bucket the
    // server reuses (`activityBucketWhere`); the day boundaries — from the shared
    // helper, the same instants the worklist sends — let "today"/"overdue" follow
    // the user's timezone. "No Activity" needs no boundary.
    case "todaysFollowUps":
      return [
        { key: "todaysFollowUps", value: "true" },
        ...boundaryConditions(),
      ];
    case "overdue":
      return [{ key: "overdue", value: "true" }, ...boundaryConditions()];
    case "noActivity":
      return [{ key: "noActivity", value: "true" }];
    default:
      return [];
  }
}

/** The three day-boundary instants an activity-window preset sends. */
function boundaryConditions(): FilterCondition[] {
  const b = dayBoundaries();
  return [
    { key: "todayStart", value: b.todayStart },
    { key: "todayEnd", value: b.todayEnd },
    { key: "tomorrowEnd", value: b.tomorrowEnd },
  ];
}
