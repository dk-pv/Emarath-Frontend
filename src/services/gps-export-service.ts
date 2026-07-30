import { env } from "@/lib/env";
import type { ListQuery } from "@/types";

/** CSV and Excel ship in GPS-08.1, mirroring the leads export (PDF not required here). */
export type GpsExportFormat = "csv" | "xlsx";

/**
 * Builds the GPS export URL for the current view (GPS-08.1).
 *
 * Carries the same filter params the summary/locations fetch sends (period +
 * Team Member), so the file requests exactly the scoped set on screen (AC2/AC4).
 */
export function buildGpsExportUrl(
  format: GpsExportFormat,
  query: ListQuery,
): string {
  const params = new URLSearchParams();
  params.set("format", format);
  for (const { key, value } of query.filters ?? []) {
    if (value === null || value === "") continue;
    params.set(key, String(value));
  }
  return `${env.apiBaseUrl}/gps/export?${params.toString()}`;
}

/**
 * Triggers the browser download. A plain anchor navigation to the endpoint lets
 * the browser stream the attachment straight to disk (the page does not navigate)
 * — no in-memory blob, which matters for a large export (AC5). The server sets the
 * filename via Content-Disposition. Same mechanism as the leads export.
 */
export function downloadGpsExport(
  format: GpsExportFormat,
  query: ListQuery,
): void {
  const anchor = document.createElement("a");
  anchor.href = buildGpsExportUrl(format, query);
  anchor.rel = "noopener";
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
}
