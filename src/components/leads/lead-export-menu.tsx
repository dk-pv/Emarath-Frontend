"use client";

import { useRef } from "react";
import { IconFileExport } from "@tabler/icons-react";
import { cn } from "@/lib/cn";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useDismissable } from "@/hooks/use-dismissable";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import type {
  ExportFormat,
  ExportScope,
} from "@/services/leads-export-service";

/**
 * The Export menu options, in the Workpex order from `leads-export-dropdown-open.png`:
 * Excel / PDF / CSV, each in "My Default" (the user's visible columns, in order) and
 * "All Fields" (the server's full standard catalogue). PDF is shown but disabled — it
 * has no library and no layout reference yet (LEAD-08.1, deferred), the same
 * shown-but-inert treatment the unbuilt quick-filter presets and Add Column use.
 */
type ExportOption =
  | {
      id: string;
      label: string;
      enabled: true;
      format: ExportFormat;
      scope: ExportScope;
    }
  | { id: string; label: string; enabled: false };

const EXPORT_OPTIONS: readonly ExportOption[] = [
  {
    id: "excel-default",
    label: "Excel (My Default)",
    enabled: true,
    format: "xlsx",
    scope: "default",
  },
  {
    id: "excel-all",
    label: "Excel (All Fields)",
    enabled: true,
    format: "xlsx",
    scope: "all",
  },
  { id: "pdf-default", label: "PDF (My Default)", enabled: false },
  { id: "pdf-all", label: "PDF (All Fields)", enabled: false },
  {
    id: "csv-default",
    label: "CSV (My Default)",
    enabled: true,
    format: "csv",
    scope: "default",
  },
  {
    id: "csv-all",
    label: "CSV (All Fields)",
    enabled: true,
    format: "csv",
    scope: "all",
  },
];

const PDF_HINT = "PDF export isn’t available yet";

type LeadExportMenuProps = {
  /** Runs the chosen export for the current view (filters/search/sort/columns). */
  onExport: (format: ExportFormat, scope: ExportScope) => void;
};

/**
 * The Leads "Export" toolbar control (LEAD-08.1). A Leads-specific popover — not the
 * shared Dropdown (which the Kanban menus still use) — so its rows can carry Workpex's
 * green hover (`leads-export-dropdown-open.png`) without touching the board. Each
 * enabled option downloads the current filtered/sorted view in that format and column
 * scope through the real `/leads/export` stream.
 */
export function LeadExportMenu({ onExport }: LeadExportMenuProps) {
  const root = useRef<HTMLDivElement>(null);
  const { isOpen, close, toggle } = useDisclosure();
  useDismissable(root, isOpen, close);

  return (
    <div ref={root} className="relative">
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={toggle}
        className={TOOLBAR_BUTTON_CLASS}
      >
        <IconFileExport size={18} stroke={1.75} />
        Export
      </button>

      {isOpen && (
        <div
          role="menu"
          aria-label="Export leads"
          className="absolute top-[calc(100%+8px)] right-0 z-50 flex w-56 flex-col rounded-surface border border-hairline bg-surface py-1 shadow-lg"
        >
          {EXPORT_OPTIONS.map((option) =>
            option.enabled ? (
              <button
                key={option.id}
                type="button"
                role="menuitem"
                onClick={() => {
                  onExport(option.format, option.scope);
                  close();
                }}
                className="focus-ring-inset flex items-center px-4 py-2.5 text-left text-[15px] text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-brand-subtle"
              >
                {option.label}
              </button>
            ) : (
              <div
                key={option.id}
                aria-disabled="true"
                title={PDF_HINT}
                className={cn(
                  "flex cursor-not-allowed items-center px-4 py-2.5 text-[15px] text-ink opacity-45",
                )}
              >
                {option.label}
              </div>
            ),
          )}
        </div>
      )}
    </div>
  );
}
