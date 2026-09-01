import { gpsEventLabel, type GpsPinRecord } from "@/services/gps-service";

export type GpsExportFormat = "csv" | "xlsx" | "pdf";

/**
 * Client-side export of the GPS activity view (GPS-08.1).
 *
 * It serialises the *already filtered* record array the screen is showing, rather than
 * re-querying the API. That is deliberate: the event filter and the table search exist
 * only in the browser, so a server-side export could not honour them without a second
 * implementation of the same filtering — and the requirement is that the file matches
 * the screen exactly. One array in, one file out.
 *
 * The spreadsheet and PDF writers are `import()`ed at call time so neither library is in
 * the page bundle; a user who never exports never downloads them.
 */

/** The columns, in the order the on-screen table shows them, plus the pin coordinates. */
const COLUMNS = [
  { header: "User Name", value: (r: GpsPinRecord) => r.agentName },
  {
    header: "Date & Time",
    value: (r: GpsPinRecord) => formatStamp(r.timestamp),
  },
  { header: "Status", value: (r: GpsPinRecord) => gpsEventLabel(r.type) },
  // Address and Notes are on screen but have no backing column in the schema; the file
  // carries the same em-dash rather than inventing a value or silently dropping columns.
  { header: "Address", value: () => "—" },
  { header: "Notes", value: () => "—" },
  { header: "Latitude", value: (r: GpsPinRecord) => r.lat.toFixed(6) },
  { header: "Longitude", value: (r: GpsPinRecord) => r.lng.toFixed(6) },
];

const pad = (n: number) => String(n).padStart(2, "0");

/** Local time, matching the cell the viewer is looking at. */
function formatStamp(iso: string): string {
  const d = new Date(iso);
  let hour = d.getHours();
  const meridiem = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${pad(d.getDate())}-${pad(d.getMonth() + 1)}-${d.getFullYear()}, ${pad(hour)}:${pad(d.getMinutes())}:${pad(d.getSeconds())} ${meridiem}`;
}

/** `emarath-gps-export-2026-09-01.<ext>` */
export function gpsExportFileName(
  format: GpsExportFormat,
  on = new Date(),
): string {
  return `emarath-gps-export-${on.getFullYear()}-${pad(on.getMonth() + 1)}-${pad(on.getDate())}.${format}`;
}

function save(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoked on the next tick so the click has taken the URL first.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/** Quotes per RFC 4180 so a comma, quote or newline in a value cannot shift a column. */
function csvCell(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

function toCsv(rows: GpsPinRecord[]): Blob {
  const lines = [
    COLUMNS.map((c) => csvCell(c.header)).join(","),
    ...rows.map((row) => COLUMNS.map((c) => csvCell(c.value(row))).join(",")),
  ];
  // The BOM makes Excel read it as UTF-8 rather than the system codepage.
  return new Blob(["﻿", lines.join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
}

async function toXlsx(rows: GpsPinRecord[]): Promise<Blob> {
  const { Workbook } = await import("exceljs");
  const book = new Workbook();
  const sheet = book.addWorksheet("GPS Activity");
  sheet.columns = COLUMNS.map((c) => ({ header: c.header, width: 22 }));
  sheet.getRow(1).font = { bold: true };
  for (const row of rows) sheet.addRow(COLUMNS.map((c) => c.value(row)));
  const buffer = await book.xlsx.writeBuffer();
  return new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
}

async function toPdf(rows: GpsPinRecord[]): Promise<Blob> {
  const { jsPDF } = await import("jspdf");
  const { default: autoTable } = await import("jspdf-autotable");
  // Landscape: seven columns do not fit portrait without wrapping every cell.
  const doc = new jsPDF({ orientation: "landscape" });
  doc.setFontSize(14);
  doc.text("Emarath — GPS Activity", 14, 14);
  doc.setFontSize(9);
  doc.text(`${rows.length} record${rows.length === 1 ? "" : "s"}`, 14, 20);
  autoTable(doc, {
    head: [COLUMNS.map((c) => c.header)],
    body: rows.map((row) => COLUMNS.map((c) => c.value(row))),
    startY: 24,
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [101, 202, 123] },
  });
  return doc.output("blob");
}

/**
 * Writes the given records to a file in `format` and hands it to the browser.
 * `records` must already be the filtered set the screen is displaying.
 */
export async function exportGpsRecords(
  format: GpsExportFormat,
  records: GpsPinRecord[],
): Promise<void> {
  const fileName = gpsExportFileName(format);
  if (format === "csv") return save(toCsv(records), fileName);
  if (format === "xlsx") return save(await toXlsx(records), fileName);
  return save(await toPdf(records), fileName);
}
