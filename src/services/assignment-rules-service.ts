import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api-client";

/**
 * Settings → Assignment → Assignment Rules.
 *
 * A real resource at `/api/assignment-rules`, not a settings row: the list is searched,
 * filtered by status, paged, and each rule owns an ordered list of configuration groups
 * (ADR-0069). Every mutation returns the rule it wrote, and the screen refetches the page
 * afterwards so the total and the ordering stay the server's.
 */
export const RULE_STATUSES = ["ACTIVE", "INACTIVE"] as const;
export type AssignmentRuleStatus = (typeof RULE_STATUSES)[number];

/** The reference's Status dropdown: the two states, plus "everything". */
export const RULE_STATUS_FILTERS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "INACTIVE", label: "Inactive" },
] as const;
export type RuleStatusFilter = (typeof RULE_STATUS_FILTERS)[number]["value"];

/** The reference's step 1 shows a single locked algorithm. */
export const ASSIGNMENT_ALGORITHMS = [
  { value: "ROUND_ROBIN", label: "Round Robin" },
] as const;
export type AssignmentAlgorithm =
  (typeof ASSIGNMENT_ALGORITHMS)[number]["value"];

/** The reference's step 2 dropdowns, each showing one option. */
export const APPLY_TO_OPTIONS = [
  { value: "ALL_RECORDS", label: "All Records" },
] as const;
export type AssignmentApplyTo = (typeof APPLY_TO_OPTIONS)[number]["value"];

export const TARGET_OPTIONS = [
  { value: "ALL_USERS", label: "All Users" },
] as const;
export type AssignmentTarget = (typeof TARGET_OPTIONS)[number]["value"];

/** The reference's footer opens on 100. */
export const RULE_PAGE_SIZES = [10, 25, 50, 100] as const;
export const DEFAULT_RULE_PAGE_SIZE = 100;

export interface AssignmentRuleGroup {
  id: string;
  name: string;
  position: number;
  applyTo: AssignmentApplyTo;
  target: AssignmentTarget;
}

export interface AssignmentRule {
  id: string;
  name: string;
  description: string;
  algorithm: AssignmentAlgorithm;
  status: AssignmentRuleStatus;
  createdByName: string | null;
  createdAt: string;
  updatedAt: string;
  groups: AssignmentRuleGroup[];
}

export interface AssignmentRuleList {
  rows: AssignmentRule[];
  total: number;
}

export interface AssignmentRuleGroupInput {
  name: string;
  applyTo: AssignmentApplyTo;
  target: AssignmentTarget;
}

export interface AssignmentRuleInput {
  name: string;
  description: string;
  algorithm: AssignmentAlgorithm;
  status: AssignmentRuleStatus;
  /** The array's order is the stored order; no position is sent. */
  groups: AssignmentRuleGroupInput[];
}

export interface RuleQuery {
  search: string;
  status: RuleStatusFilter;
  page: number;
  size: number;
}

export function fetchAssignmentRules(
  query: RuleQuery,
  signal?: AbortSignal,
): Promise<AssignmentRuleList> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.search.trim() !== "") params.set("search", query.search.trim());
  // "All statuses" is the absence of the filter, not a third state.
  if (query.status !== "ALL") params.set("status", query.status);

  return apiGet<AssignmentRuleList>("/assignment-rules", params, signal);
}

export function createAssignmentRule(
  input: AssignmentRuleInput,
): Promise<AssignmentRule> {
  return apiPost<AssignmentRule>("/assignment-rules", input);
}

export function updateAssignmentRule(
  id: string,
  input: AssignmentRuleInput,
): Promise<AssignmentRule> {
  return apiPatch<AssignmentRule>(`/assignment-rules/${id}`, input);
}

export function deleteAssignmentRule(id: string): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/assignment-rules/${id}`);
}
