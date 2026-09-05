import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/** The wizard's access select; both options are visible in the reference. */
export const PIPELINE_ACCESS_MODES = [
  { value: "ALL_USERS", label: "All Users" },
  { value: "SPECIFIC", label: "Specific" },
] as const;

/** The Permission Type select's two options. */
export const PERMISSION_TYPES = [
  { value: "ROLE", label: "Role" },
  { value: "USER", label: "User" },
] as const;

/**
 * The wizard's fixed template catalogue — exactly the eight names the reference dropdown
 * lists, in its order. What each contributes is not evidenced, so the backend records the
 * choice and clones nothing until those definitions exist (ADR-0060).
 */
export const PIPELINE_TEMPLATES = [
  "Education",
  "Real Estate",
  "Car Sales",
  "Product",
  "Travel",
  "Software",
  "Automobiles",
  "Stock Broking",
] as const;

/** The wizard's "Set Expiry For" select — exactly the two options the reference lists. */
export const EXPIRY_SCOPES = [
  { value: "ALL_LEADS", label: "All Leads" },
  { value: "INDIVIDUAL_LEADS", label: "Individual Leads" },
] as const;

export type ExpiryScope = (typeof EXPIRY_SCOPES)[number]["value"];

/** The reference's "Expire After (Days)" accepts whole days from one upwards. */
export const MIN_EXPIRY_DAYS = 1;

/**
 * Wizard step 3 — Pipeline Settings and Lead Expiry Settings.
 *
 * Stages are referenced by id, not by name: the settings are internal configuration
 * rather than lead data, so a foreign key keeps them valid through a stage rename and
 * clears them on a delete (ADR-0061). The expiry fields survive `expiryEnabled` going
 * false, which is what lets the toggle be switched back on with its configuration intact.
 */
export interface PipelineSettings {
  defaultStageId: string | null;
  mandatoryValueStageId: string | null;
  qualifiedStageId: string | null;
  autoConvertAtWon: boolean;
  expiryEnabled: boolean;
  expiryScope: ExpiryScope | null;
  expiryDays: number | null;
  expiredStageId: string | null;
  reassignedStageId: string | null;
  reassignExpiredToId: string | null;
}

/** What step 3 submits. `defaultStageId` is the one field the reference marks required. */
export type PipelineSettingsInput = Omit<PipelineSettings, "defaultStageId"> & {
  defaultStageId: string;
};

export interface PipelinePermissionNode {
  id: string;
  permissionType: "ROLE" | "USER";
  roleId: string | null;
  userId: string | null;
  label: string | null;
}

export interface PipelinePermissionInput {
  permissionType: "ROLE" | "USER";
  roleId?: string;
  userId?: string;
}

/**
 * One pipeline as `GET /api/pipelines` returns it — the reference table's five columns.
 *
 * `leadCount` is a live server-side aggregate over `Lead.pipeline`, not a stored number,
 * so it tracks lead creation, deletion and pipeline changes without anything to keep in
 * step. `shortCode` is null on the pipelines that predate the catalogue (ADR-0059).
 */
export interface PipelineNode {
  id: string;
  name: string;
  shortCode: string | null;
  isDefault: boolean;
  leadCount: number;
  createdByName: string | null;
  createdAt: string;
  accessMode: "ALL_USERS" | "SPECIFIC";
  templateKey: string | null;
  permissions: PipelinePermissionNode[];
  settings: PipelineSettings;
}

export interface CreatePipelineInput {
  name: string;
  shortCode: string;
  accessMode?: "ALL_USERS" | "SPECIFIC";
  permissions?: PipelinePermissionInput[];
  templateKey?: string;
}

export interface UpdatePipelineInput {
  name?: string;
  shortCode?: string;
  accessMode?: "ALL_USERS" | "SPECIFIC";
  permissions?: PipelinePermissionInput[];
  /** Step 3. Omitted by step 1's save, which leaves every stored setting untouched. */
  settings?: PipelineSettingsInput;
}

export function fetchPipelines(signal?: AbortSignal): Promise<PipelineNode[]> {
  return apiGet<PipelineNode[]>("/pipelines", undefined, signal);
}

export function createPipeline(
  input: CreatePipelineInput,
): Promise<PipelineNode> {
  return apiPost<PipelineNode>("/pipelines", input);
}

export function updatePipeline(
  id: string,
  input: UpdatePipelineInput,
): Promise<PipelineNode> {
  return apiPatch<PipelineNode>(`/pipelines/${id}`, input);
}

/**
 * Makes one pipeline the default. The API answers with the whole catalogue because the
 * previous default changed too — anything narrower would leave the table showing two.
 */
export function setDefaultPipeline(id: string): Promise<PipelineNode[]> {
  return apiPatch<PipelineNode[]>(`/pipelines/${id}/default`, {});
}

export function deletePipeline(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/pipelines/${id}`);
}

/**
 * The reference table's two-line stamp: `04-02-2026` over `6:31:45 PM`.
 *
 * Rendered in the viewer's local zone, which is what the rest of the app does with
 * timestamps — the API sends ISO-8601 with an offset, so no zone is assumed here.
 */
export function formatPipelineStamp(iso: string): {
  date: string;
  time: string;
} {
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return { date: "—", time: "" };

  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = value.getHours();
  const suffix = hours >= 12 ? "PM" : "AM";
  const twelve = hours % 12 === 0 ? 12 : hours % 12;

  return {
    date: `${pad(value.getDate())}-${pad(value.getMonth() + 1)}-${value.getFullYear()}`,
    time: `${twelve}:${pad(value.getMinutes())}:${pad(value.getSeconds())} ${suffix}`,
  };
}
