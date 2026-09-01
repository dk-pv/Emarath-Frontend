"use client";

import { IconFileExport } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import type { GpsExportFormat } from "@/lib/gps-export";

/**
 * The GPS "Export" control (GPS-08.1) — CSV, XLSX and PDF, in the order the Workpex
 * menu lists them. Composed from the shared `Dropdown`, the same primitive the Leads
 * Export menu uses. Each option writes the records the screen is currently showing,
 * so the file always matches the view.
 */
const OPTIONS: { id: string; label: string; format: GpsExportFormat }[] = [
  { id: "csv", label: "CSV", format: "csv" },
  { id: "xlsx", label: "XLSX", format: "xlsx" },
  { id: "pdf", label: "PDF", format: "pdf" },
];

export function GpsExportMenu({
  onExport,
  disabled = false,
}: {
  onExport: (format: GpsExportFormat) => void;
  /** True while a file is being written, so a second click cannot start another. */
  disabled?: boolean;
}) {
  const items: DropdownItem[] = OPTIONS.map((option) => ({
    type: "item",
    id: option.id,
    label: option.label,
    disabled,
    onSelect: () => onExport(option.format),
  }));

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span className={TOOLBAR_BUTTON_CLASS}>
          <IconFileExport size={18} stroke={1.75} />
          Export
        </span>
      }
    />
  );
}
