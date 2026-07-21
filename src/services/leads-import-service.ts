import { apiGet, apiPostForm } from "@/lib/api-client";
import { env } from "@/lib/env";
import type { FieldMapping } from "@/components/leads/import/import-data";

/**
 * The Leads bulk-import API (LEAD-07.1). Every call here maps to an endpoint in
 * `project-docs/API_NOTES/leads-import-api.md`; the wizard talks to the backend
 * only through this module.
 *
 * Types mirror the backend response DTOs. They are declared here, next to the
 * fetches, rather than in a shared module — the backend is the source of truth and
 * a generated client replaces these later (same reasoning as `leads-service.ts`).
 */

/** A target field a file column can map onto (`GET /fields`). */
export interface ImportFieldOption {
  value: string;
  label: string;
  required: boolean;
}

/** The detected header row and a bounded preview (`POST /parse`). */
export interface ParseResult {
  columns: string[];
  preview: Record<string, string>[];
  totalRows: number;
}

export type RowStatus = "valid" | "invalid" | "duplicate";

export interface RowIssue {
  reason: string;
  errorCode: string;
}

/** One classified row in the preview (`POST /validate`). */
export interface ValidatedRow {
  rowNumber: number;
  values: Record<string, string>;
  status: RowStatus;
  error: RowIssue | null;
}

export interface ValidateResult {
  total: number;
  valid: number;
  invalid: number;
  duplicates: number;
  rows: ValidatedRow[];
}

/** A job's live state (`POST /import` then `GET /:jobId`, and `GET /history`). */
export interface ImportJob {
  id: string;
  module: string;
  status: "PENDING" | "PROCESSING" | "COMPLETED" | "FAILED";
  fileName: string;
  pipeline: string;
  totalRows: number;
  processedRows: number;
  importedCount: number;
  skippedCount: number;
  failedCount: number;
  startedAt: string | null;
  completedAt: string | null;
  importedBy: { id: string; name: string } | null;
}

/** A failed/skipped row for review and the CSV report (`GET /:jobId/errors`). */
export interface ImportRowError {
  rowNumber: number;
  values: Record<string, string>;
  reason: string;
  errorCode: string;
}

export function fetchImportFields(
  signal?: AbortSignal,
): Promise<ImportFieldOption[]> {
  return apiGet<{ fields: ImportFieldOption[] }>(
    "/leads/import/fields",
    undefined,
    signal,
  ).then((result) => result.fields);
}

export function parseImportFile(
  file: File,
  signal?: AbortSignal,
): Promise<ParseResult> {
  const form = new FormData();
  form.append("file", file);
  return apiPostForm<ParseResult>("/leads/import/parse", form, signal);
}

export function validateImport(
  file: File,
  mapping: FieldMapping,
  pipeline: string,
  signal?: AbortSignal,
): Promise<ValidateResult> {
  return apiPostForm<ValidateResult>(
    "/leads/import/validate",
    importForm(file, mapping, pipeline),
    signal,
  );
}

export function startImport(
  file: File,
  mapping: FieldMapping,
  pipeline: string,
  signal?: AbortSignal,
): Promise<{ jobId: string }> {
  return apiPostForm<{ jobId: string }>(
    "/leads/import",
    importForm(file, mapping, pipeline),
    signal,
  );
}

export function fetchImportJob(
  jobId: string,
  signal?: AbortSignal,
): Promise<ImportJob> {
  return apiGet<ImportJob>(`/leads/import/${jobId}`, undefined, signal);
}

export function fetchImportErrors(
  jobId: string,
  signal?: AbortSignal,
): Promise<ImportRowError[]> {
  return apiGet<{ errors: ImportRowError[] }>(
    `/leads/import/${jobId}/errors`,
    undefined,
    signal,
  ).then((result) => result.errors);
}

export function fetchImportHistory(signal?: AbortSignal): Promise<ImportJob[]> {
  return apiGet<{ jobs: ImportJob[] }>(
    "/leads/import/history",
    undefined,
    signal,
  ).then((result) => result.jobs);
}

/** The direct URL for the CSV error report — used as an anchor href (browser download). */
export function importErrorsCsvUrl(jobId: string): string {
  return `${env.apiBaseUrl}/leads/import/${jobId}/errors?format=csv`;
}

function importForm(
  file: File,
  mapping: FieldMapping,
  pipeline: string,
): FormData {
  const form = new FormData();
  form.append("file", file);
  form.append("mapping", JSON.stringify(mapping));
  form.append("pipeline", pipeline);
  return form;
}
