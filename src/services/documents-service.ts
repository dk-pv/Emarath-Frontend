import { apiDelete, apiGet, apiPatch, apiPostForm } from "@/lib/api-client";
import type { ListQuery, ListResult } from "@/types";

/** A user reference as the Documents columns render one ("Uploaded By", "Access"). */
export interface DocumentUserRef {
  id: string;
  name: string;
}

/**
 * One document as the upload endpoint returns it (DOC-02.1). Mirrors the backend
 * `DocumentResponse` — declared next to the call, like `LeadListItem`, because the
 * backend DTO is the source of truth and a shared mirror would drift silently.
 * The file is reached only through `downloadUrl` (a short-lived signed link); the
 * raw storage key is never exposed.
 */
export interface DocumentResponse {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  category: string | null;
  createdAt: string;
  uploadedBy: DocumentUserRef;
  access: DocumentUserRef[];
  downloadUrl: string;
}

/**
 * One document as the list endpoint returns it (DOC-03.1), mirroring the backend
 * `DocumentListItem`. Narrower than the upload response — no `access` — and every row
 * carries a short-lived signed `downloadUrl`; the raw storage key is never exposed.
 */
export interface DocumentListItem {
  id: string;
  title: string;
  fileName: string;
  sizeBytes: number;
  contentType: string;
  createdAt: string;
  uploadedBy: DocumentUserRef;
  downloadUrl: string;
}

/**
 * The file types the "All Documents" dropdown offers (DOC-06.1), mirroring the backend
 * `DOCUMENT_TYPE_FILTERS`. Labels are the uppercase value ("PNG"); "All Documents" is the
 * default (no filter) and is expressed as `null`, not a member.
 */
export const DOCUMENT_TYPE_FILTERS = [
  "xlsx",
  "png",
  "jpg",
  "pdf",
  "docx",
  "txt",
  "csv",
  "svg",
] as const;

export type DocumentTypeValue = (typeof DOCUMENT_TYPE_FILTERS)[number];

/**
 * Fetches one scoped page of documents (DOC-03.1). Matches the `ListSource` shape the shared
 * table framework expects, so the same Table + pagination the other modules use drives it.
 * The sort state is split into the backend's `sort`/`direction` params; when unset the API
 * applies its default (newest first). An optional `type` applies the "All Documents"
 * file-type filter (DOC-06.1), narrowing within the caller's scope.
 */
export async function fetchDocuments(
  query: ListQuery,
  type?: DocumentTypeValue,
  signal?: AbortSignal,
): Promise<ListResult<DocumentListItem>> {
  const params = new URLSearchParams({
    page: String(query.page),
    size: String(query.size),
  });
  if (query.sort) {
    params.set("sort", query.sort.key);
    params.set("direction", query.sort.direction);
  }
  if (type) params.set("type", type);
  return apiGet<ListResult<DocumentListItem>>("/documents", params, signal);
}

/**
 * Loads one document with its current access list (DOC-04.1) for the Edit drawer to prefill.
 * Returns the full `DocumentResponse` (with `access`); a 404 means out of scope / deleted.
 */
export function fetchDocument(
  id: string,
  signal?: AbortSignal,
): Promise<DocumentResponse> {
  return apiGet<DocumentResponse>(`/documents/${id}`, undefined, signal);
}

/** The Edit Document payload (DOC-04.1). Both fields optional — rename, re-share, or both. */
export interface UpdateDocumentInput {
  title?: string;
  userIds?: string[];
}

/** Renames and/or re-shares a document (DOC-04.1). Returns the updated document. */
export function updateDocument(
  id: string,
  input: UpdateDocumentInput,
  signal?: AbortSignal,
): Promise<DocumentResponse> {
  return apiPatch<DocumentResponse>(`/documents/${id}`, input, signal);
}

/**
 * Permanently deletes a document — its record and stored file (DOC-05.1). Returns the
 * removed id; a 403 means the caller may not delete it, a 404 that it is out of scope.
 */
export function deleteDocument(
  id: string,
  signal?: AbortSignal,
): Promise<{ id: string }> {
  return apiDelete<{ id: string }>(`/documents/${id}`, signal);
}

/**
 * Allowed upload types and size for pre-upload validation (DOC-02.2 AC5), mirroring
 * the backend storage policy defaults (STORAGE_ALLOWED_EXTENSIONS / STORAGE_MAX_BYTES).
 * This is UX only — it fails a bad file before it reaches the network; `StorageService.put`
 * remains the authoritative gate server-side, so the rule holds even if these drift.
 */
export const ALLOWED_EXTENSIONS = [
  "xlsx",
  "png",
  "jpg",
  "jpeg",
  "pdf",
  "docx",
  "txt",
  "csv",
  "svg",
] as const;
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;
/** `accept` attribute for the file input, derived from the allowed extensions. */
export const ACCEPT_ATTR = ALLOWED_EXTENSIONS.map((ext) => `.${ext}`).join(",");

const EXTENSION = /\.([^.]+)$/;

/** Client-side file check (AC5). Returns an error message, or null when the file is allowed. */
export function validateDocumentFile(file: File): string | null {
  const ext = EXTENSION.exec(file.name)?.[1]?.toLowerCase();
  if (
    !ext ||
    !ALLOWED_EXTENSIONS.includes(ext as (typeof ALLOWED_EXTENSIONS)[number])
  ) {
    return `File type "${ext ?? "unknown"}" is not allowed. Allowed: ${ALLOWED_EXTENSIONS.join(", ")}.`;
  }
  if (file.size <= 0) return "The file is empty.";
  if (file.size > MAX_UPLOAD_BYTES) {
    const maxMb = Math.round(MAX_UPLOAD_BYTES / (1024 * 1024));
    return `The file exceeds the ${maxMb} MB limit.`;
  }
  return null;
}

export interface UploadDocumentInput {
  file: File;
  /** The "File name" title — a user-entered display name, not the file's own name. */
  title: string;
  /** "Select Users" access whitelist; empty means owner-only (DOC-02.1 AC4). */
  userIds?: string[];
}

/**
 * Uploads a document through the shared DOC-02.1 endpoint (`POST /api/documents`,
 * multipart). Repeated `userIds` parts map to the backend's array field; the file
 * part is `file`. Reuses `apiPostForm`, so credentials ride along and NestJS
 * validation messages surface as an `ApiError`.
 */
export function uploadDocument(
  input: UploadDocumentInput,
  signal?: AbortSignal,
): Promise<DocumentResponse> {
  const form = new FormData();
  form.append("file", input.file);
  form.append("title", input.title);
  for (const id of input.userIds ?? []) form.append("userIds", id);
  return apiPostForm<DocumentResponse>("/documents", form, signal);
}

/** A human-readable file size for the selected-file chip (e.g. "1.65 MB"). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(0)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}
