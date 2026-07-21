import { env } from "@/lib/env";
import { appendLeadFilterParams } from "@/services/leads-service";
import type { ListQuery } from "@/types";

/** CSV and Excel ship in LEAD-08.1; PDF is deferred (no library / layout reference yet). */
export type ExportFormat = "csv" | "xlsx";

/** `default` exports the visible columns; `all` exports every field. */
export type ExportScope = "default" | "all";

/**
 * Builds the export URL for the current view (LEAD-08.1).
 *
 * Reuses `appendLeadFilterParams`, the same mapping the list fetch uses, so the
 * file requests exactly the filtered/searched/sorted set on screen (AC1). For the
 * "My Default" scope it sends the visible column ids in order (AC3); "All Fields"
 * sends none and the server uses its full catalog.
 */
export function buildLeadsExportUrl(
  format: ExportFormat,
  scope: ExportScope,
  query: ListQuery,
  columnKeys: readonly string[],
): string {
  const params = new URLSearchParams();
  params.set("format", format);
  params.set("scope", scope);
  appendLeadFilterParams(params, query);
  if (scope === "default") params.set("columns", columnKeys.join(","));

  return `${env.apiBaseUrl}/leads/export?${params.toString()}`;
}

/**
 * Triggers the browser download. A plain anchor navigation to the endpoint lets the
 * browser stream the file straight to disk (the response is an attachment, so the
 * page does not navigate) — no in-memory blob, which matters for a large export
 * (AC5). The server sets the filename via Content-Disposition.
 */
export function downloadLeadsExport(
  format: ExportFormat,
  scope: ExportScope,
  query: ListQuery,
  columnKeys: readonly string[],
): void {
  const anchor = document.createElement("a");
  anchor.href = buildLeadsExportUrl(format, scope, query, columnKeys);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
