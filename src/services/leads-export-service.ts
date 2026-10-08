import { apiGetBlob } from "@/lib/api-client";
import { saveBlob } from "@/lib/download";
import { appendLeadFilterParams } from "@/services/leads-service";
import type { ListQuery } from "@/types";

/** CSV and Excel ship in LEAD-08.1; PDF is deferred (no library / layout reference yet). */
export type ExportFormat = "csv" | "xlsx";

/** `default` exports the visible columns; `all` exports every field. */
export type ExportScope = "default" | "all";

/**
 * The export request for the current view (LEAD-08.1).
 *
 * Reuses `appendLeadFilterParams`, the same mapping the list fetch uses, so the
 * file requests exactly the filtered/searched/sorted set on screen (AC1). For the
 * "My Default" scope it sends the visible column ids in order (AC3); "All Fields"
 * sends none and the server uses its full catalog.
 */
export function leadsExportParams(
  format: ExportFormat,
  scope: ExportScope,
  query: ListQuery,
  columnKeys: readonly string[],
): URLSearchParams {
  const params = new URLSearchParams();
  params.set("format", format);
  params.set("scope", scope);
  appendLeadFilterParams(params, query);
  if (scope === "default") params.set("columns", columnKeys.join(","));
  return params;
}

/**
 * Downloads the export for the current view. It is fetched through the API client —
 * not a plain link — so an expired access token is refreshed and a refused export
 * throws an `ApiError` the list can show (ADR-0009, amended 2026-10-07: the file is now
 * buffered in memory, which the 100,000-row cap keeps to a few megabytes).
 */
export async function downloadLeadsExport(
  format: ExportFormat,
  scope: ExportScope,
  query: ListQuery,
  columnKeys: readonly string[],
): Promise<void> {
  const blob = await apiGetBlob(
    "/leads/export",
    leadsExportParams(format, scope, query, columnKeys),
  );
  saveBlob(blob, exportFileName(format));
}

/** `leads-YYYYMMDD-HHmmss.<ext>` in local time — the server's naming pattern. */
function exportFileName(format: ExportFormat): string {
  const now = new Date();
  const pad = (n: number): string => String(n).padStart(2, "0");
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  return `leads-${stamp}.${format}`;
}
