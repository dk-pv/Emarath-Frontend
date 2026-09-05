import { apiDelete, apiGet, apiPatch, apiPost, apiPut } from "@/lib/api-client";

/**
 * Settings → Activity and Reminders.
 *
 * Two JSON rows in `app_settings`, read and written like every other settings screen.
 * The vocabularies mirror `activity-reminders.dto.ts` so the offered options and the
 * accepted values cannot drift (ADR-0071).
 */

/** Transcribed from the reference's open Reminder Time dropdown, in its order. */
export const REMINDER_TIME_OPTIONS = [
  { value: "AT_TIME_OF_EVENT", label: "At time of Event" },
  { value: "MIN_5_BEFORE", label: "5 Minutes Before" },
  { value: "MIN_15_BEFORE", label: "15 Minutes Before" },
  { value: "MIN_30_BEFORE", label: "30 Minutes Before" },
  { value: "HOUR_1_BEFORE", label: "1 Hour Before" },
  { value: "HOUR_2_BEFORE", label: "2 Hour Before" },
] as const;
export type ReminderTime = (typeof REMINDER_TIME_OPTIONS)[number]["value"];

/** Transcribed from the reference's open Overdue After dropdown. */
export const OVERDUE_AFTER_OPTIONS = [
  { value: 15, label: "15 Minutes" },
  { value: 30, label: "30 Minutes" },
  { value: 45, label: "45 Minutes" },
  { value: 60, label: "60 Minutes" },
] as const;
export type OverdueMinutes = (typeof OVERDUE_AFTER_OPTIONS)[number]["value"];

export type OverdueMode = "END_OF_DAY" | "CUSTOM_TIME_SPAN";

export interface ActivityGeneralSettings {
  autoPromptFollowUpOnCompletion: boolean;
  followUpMandatoryOnStatusChange: boolean;
  remindersEnabled: boolean;
  reminderTime: ReminderTime;
  overdueMode: OverdueMode;
  overdueAfterMinutes: OverdueMinutes;
}

/**
 * The follow-up form's field catalogue — the seven the reference's builder lists. Each is
 * a real column on the activity, which is why the list is closed.
 */
export const FOLLOW_UP_FIELDS = [
  { key: "DESCRIPTION", label: "Description" },
  { key: "ASSIGNED_TO", label: "Assigned To" },
  { key: "LEAD_NAME", label: "Lead Name" },
  { key: "DUE_DATE", label: "Due Date" },
  { key: "START_TIME", label: "Start Time" },
  { key: "END_TIME", label: "End Time" },
  { key: "LOCATION", label: "Location" },
] as const;
export type FollowUpFieldKey = (typeof FOLLOW_UP_FIELDS)[number]["key"];

export const FOLLOW_UP_FIELD_LABELS: Record<FollowUpFieldKey, string> =
  Object.fromEntries(
    FOLLOW_UP_FIELDS.map((field) => [field.key, field.label]),
  ) as Record<FollowUpFieldKey, string>;

/**
 * The five the create API refuses a follow-up without. They stay selected, so a saved
 * configuration can never produce a form that cannot be submitted — only End Time and
 * Location move between the panels, which is the split the reference itself draws.
 */
export const REQUIRED_FOLLOW_UP_FIELDS: readonly FollowUpFieldKey[] = [
  "DESCRIPTION",
  "ASSIGNED_TO",
  "LEAD_NAME",
  "DUE_DATE",
  "START_TIME",
];

export const MAX_FOLLOW_UP_TYPE_NAME = 60;

export interface FollowUpTypeField {
  key: FollowUpFieldKey;
  /** 1-based and contiguous — the order the follow-up form renders. */
  position: number;
}

export interface FollowUpType {
  id: string;
  name: string;
  isActive: boolean;
  /** Set only on the three shipped types, which are the stored activity types. */
  activityType: "CALL" | "MEETING" | "TASK" | null;
  createdBy: string;
  createdAt: string;
  fields: FollowUpTypeField[];
}

export interface SaveFollowUpTypeInput {
  name: string;
  isActive: boolean;
  fields: FollowUpTypeField[];
}

/** What the Add Follow-up form itself reads — any signed-in user, not just an admin. */
export interface ActivityWorkflowSettings {
  general: ActivityGeneralSettings;
  followUpTypes: FollowUpType[];
}

const GENERAL = "/settings/activity-reminders/general";
const TYPES = "/settings/activity-reminders/follow-up-types";

export function fetchActivityGeneral(
  signal?: AbortSignal,
): Promise<ActivityGeneralSettings> {
  return apiGet<ActivityGeneralSettings>(GENERAL, undefined, signal);
}

export function saveActivityGeneral(
  input: ActivityGeneralSettings,
): Promise<ActivityGeneralSettings> {
  return apiPut<ActivityGeneralSettings>(GENERAL, input);
}

export function fetchFollowUpTypes(
  signal?: AbortSignal,
): Promise<FollowUpType[]> {
  return apiGet<FollowUpType[]>(TYPES, undefined, signal);
}

/** Every mutation answers with the whole list, so the table redraws without a refetch. */
export function createFollowUpType(
  input: SaveFollowUpTypeInput,
): Promise<FollowUpType[]> {
  return apiPost<FollowUpType[]>(TYPES, input);
}

export function updateFollowUpType(
  id: string,
  input: SaveFollowUpTypeInput,
): Promise<FollowUpType[]> {
  return apiPatch<FollowUpType[]>(`${TYPES}/${id}`, input);
}

export function deleteFollowUpType(id: string): Promise<FollowUpType[]> {
  return apiDelete<FollowUpType[]>(`${TYPES}/${id}`);
}

export function fetchActivityWorkflow(
  signal?: AbortSignal,
): Promise<ActivityWorkflowSettings> {
  return apiGet<ActivityWorkflowSettings>(
    "/settings/activity-reminders/workflow",
    undefined,
    signal,
  );
}
