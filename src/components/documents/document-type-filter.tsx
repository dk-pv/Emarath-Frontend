"use client";

import { IconChevronDown, IconFilter } from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import { cn } from "@/lib/cn";
import {
  DOCUMENT_TYPE_FILTERS,
  type DocumentTypeValue,
} from "@/services/documents-service";

type DocumentTypeFilterProps = {
  /** The active file type, or null for "All Documents". */
  active: DocumentTypeValue | null;
  /** Apply a type, or clear (null). Re-selecting the active type clears it. */
  onChange: (type: DocumentTypeValue | null) => void;
};

/**
 * The Documents "All Documents" file-type filter (DOC-06.1), from
 * `documents-all-documents-dropdown-open-option-hover.png` — a single-select menu of the
 * allowed file types over the shared Dropdown (the same primitive the Leads menus use).
 * Selecting a type narrows the list in one click; re-selecting it clears back to All
 * Documents (the Leads Quick Filter convention — the reference shows no "All" row). The
 * trigger names the active type and turns green while a filter is applied. The reference's
 * "Last Modified" entry is intentionally omitted until a screenshot captures its behaviour.
 */
export function DocumentTypeFilter({
  active,
  onChange,
}: DocumentTypeFilterProps) {
  const items: DropdownItem[] = DOCUMENT_TYPE_FILTERS.map((type) => ({
    type: "item",
    id: type,
    label: type.toUpperCase(),
    selected: active === type,
    onSelect: () => onChange(active === type ? null : type),
  }));

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span
          className={cn(
            "focus-ring inline-flex h-control-sm shrink-0 cursor-pointer items-center gap-2 rounded-control border border-hairline bg-surface px-3 text-sm font-medium text-ink transition-colors duration-(--duration-shell) ease-shell hover:bg-canvas",
            active !== null &&
              "border-brand/30 bg-brand-subtle text-brand-strong hover:bg-brand-subtle",
          )}
        >
          <IconFilter size={16} stroke={1.75} aria-hidden="true" />
          {active ? active.toUpperCase() : "All Documents"}
          <IconChevronDown
            size={16}
            stroke={1.75}
            className={active !== null ? "text-brand-strong" : "text-ink-muted"}
          />
        </span>
      }
    />
  );
}
