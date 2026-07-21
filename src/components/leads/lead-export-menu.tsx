"use client";

import { IconChevronDown, IconFileExport } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import type {
  ExportFormat,
  ExportScope,
} from "@/services/leads-export-service";

/**
 * The Export menu options, in the Workpex order from
 * `leads-export-dropdown-open.png`: Excel / PDF / CSV, each in "My Default" (the
 * user's visible columns) and "All Fields". PDF is shown but disabled — it has no
 * library and no layout reference yet (LEAD-08.1, deferred), the same
 * shown-but-inert treatment the unbuilt quick-filter presets use.
 */
type ExportOption =
  | { id: string; label: string; enabled: true; format: ExportFormat; scope: ExportScope }
  | { id: string; label: string; enabled: false };

const EXPORT_OPTIONS: ExportOption[] = [
  { id: "excel-default", label: "Excel (My Default)", enabled: true, format: "xlsx", scope: "default" },
  { id: "excel-all", label: "Excel (All Fields)", enabled: true, format: "xlsx", scope: "all" },
  { id: "pdf-default", label: "PDF (My Default)", enabled: false },
  { id: "pdf-all", label: "PDF (All Fields)", enabled: false },
  { id: "csv-default", label: "CSV (My Default)", enabled: true, format: "csv", scope: "default" },
  { id: "csv-all", label: "CSV (All Fields)", enabled: true, format: "csv", scope: "all" },
];

const PDF_HINT = "PDF export isn’t available yet";

type LeadExportMenuProps = {
  /** Runs the chosen export for the current view (filters/search/sort/columns). */
  onExport: (format: ExportFormat, scope: ExportScope) => void;
};

/**
 * The Leads "Export" toolbar control (LEAD-08.1), composed from the shared Dropdown
 * — the same primitive the Sort and Quick Filter menus use. Each enabled option
 * downloads the current filtered/sorted view in that format and column scope.
 */
export function LeadExportMenu({ onExport }: LeadExportMenuProps) {
  const items: DropdownItem[] = EXPORT_OPTIONS.map((option) =>
    option.enabled
      ? {
          type: "item",
          id: option.id,
          label: option.label,
          onSelect: () => onExport(option.format, option.scope),
        }
      : {
          type: "item",
          id: option.id,
          label: option.label,
          disabled: true,
          hint: PDF_HINT,
        },
  );

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span className="inline-flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink transition-colors duration-(--duration-shell) ease-shell">
          <IconFileExport size={18} stroke={1.75} />
          Export
          <IconChevronDown
            size={16}
            stroke={1.75}
            className="text-ink-muted"
          />
        </span>
      }
    />
  );
}
