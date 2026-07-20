"use client";

import {
  IconArrowNarrowDown,
  IconArrowNarrowUp,
  IconArrowsSort,
} from "@tabler/icons-react";
import { Dropdown, type DropdownItem } from "@/components/ui/Dropdown";
import type { SortState } from "@/types";

/**
 * The columns the Sort menu offers, in the order Workpex lists them in
 * `leads-sort-dropdown-open.png`.
 *
 * This is the intersection of that menu and the columns the list API can sort by
 * (LEAD-02.1's whitelist). Workpex also lists Lead Pipeline, Secondary Phone and
 * Complaints, and the menu scrolls beyond what the screenshot captures; those are
 * not offered because the backend does not sort by them yet — showing them would
 * be a control that cannot work. Each maps to a `sort` key the API accepts.
 */
const SORT_COLUMNS: readonly { key: string; label: string }[] = [
  { key: "name", label: "Customer Name" },
  { key: "primaryPhone", label: "Primary Phone" },
  { key: "source", label: "Source" },
  { key: "status", label: "Lead Status" },
  { key: "createdAt", label: "Created Date" },
  { key: "country", label: "Country" },
  { key: "firstName", label: "First Name" },
];

type LeadSortMenuProps = {
  sort: SortState | undefined;
  onSortChange: (sort: SortState) => void;
};

/**
 * The Leads "Sort" toolbar control (LEAD-03.3), composed from the shared
 * Dropdown — no new popup primitive. Picking a column sorts by it ascending;
 * picking the active column again flips the direction, and that column carries a
 * direction arrow so the current order is legible.
 */
export function LeadSortMenu({ sort, onSortChange }: LeadSortMenuProps) {
  const items: DropdownItem[] = SORT_COLUMNS.map((column) => {
    const isActive = sort?.key === column.key;
    const icon = !isActive
      ? IconArrowsSort
      : sort.direction === "asc"
        ? IconArrowNarrowUp
        : IconArrowNarrowDown;

    return {
      type: "item",
      id: column.key,
      label: column.label,
      icon,
      onSelect: () =>
        onSortChange({
          key: column.key,
          direction: isActive && sort.direction === "asc" ? "desc" : "asc",
        }),
    };
  });

  return (
    <Dropdown
      align="end"
      items={items}
      trigger={
        <span className="inline-flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink">
          <IconArrowsSort size={18} stroke={1.75} />
          Sort
        </span>
      }
    />
  );
}
