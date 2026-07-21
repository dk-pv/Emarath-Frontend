import type { FilterCondition } from "@/types";

/**
 * The Quick Filter presets, in the order Workpex lists them (LEAD-04.1), read from
 * `ui-reference/leads/Quick-Filter.mp4`.
 *
 * `enabled: false` marks the activity-driven presets whose data (follow-ups, last
 * activity) comes from the Activities module, which ships in Sprint 3. They are
 * shown — so the menu matches Workpex — but disabled until that backend exists.
 * Every enabled preset resolves to conditions the existing Leads list pipeline
 * already carries (status, a createdAt window, or an unassigned/archived flag); no
 * new filter builder is introduced.
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
  { id: "archived", label: "Archived", enabled: true },
  { id: "converted", label: "Converted Leads", enabled: true },
  { id: "todaysFollowUps", label: "Today's Follow Ups", enabled: false },
  { id: "noActivity", label: "No Activity Leads", enabled: false },
  { id: "overdue", label: "Overdue Lead", enabled: false },
  { id: "newLeads", label: "New Leads", enabled: true },
  { id: "expired", label: "Expired Leads", enabled: false },
  { id: "unassigned", label: "Unassigned", enabled: true },
];

/** Why a disabled preset is unavailable — surfaced as the menu item's tooltip. */
export const DISABLED_PRESET_HINT =
  "Available once the Activities module ships (Sprint 3)";

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
    case "archived":
      return [{ key: "archived", value: "true" }];
    case "unassigned":
      return [{ key: "unassigned", value: "true" }];
    case "converted":
      return [{ key: "status", value: ["WON"] }];
    case "newLeads":
      return [{ key: "status", value: ["New"] }];
    default:
      return [];
  }
}
