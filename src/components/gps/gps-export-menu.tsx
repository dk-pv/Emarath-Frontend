"use client";

import { IconFileExport } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import type { GpsExportFormat } from "@/services/gps-export-service";

/**
 * The GPS "Export" control (GPS-08.1) — the Workpex Export button on the GPS Map
 * screen. Composed from the shared `Dropdown`, the same primitive the Leads Export
 * menu uses; each option downloads the current scoped/filtered view in that format.
 * Excel and CSV only, matching the leads export (its expanded menu is the app's
 * established Export pattern; the GPS button's open state is not separately captured).
 */
const OPTIONS: { id: string; label: string; format: GpsExportFormat }[] = [
  { id: "excel", label: "Excel", format: "xlsx" },
  { id: "csv", label: "CSV", format: "csv" },
];

export function GpsExportMenu({
  onExport,
}: {
  onExport: (format: GpsExportFormat) => void;
}) {
  const items: DropdownItem[] = OPTIONS.map((option) => ({
    type: "item",
    id: option.id,
    label: option.label,
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
