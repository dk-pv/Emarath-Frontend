"use client";

import Link from "next/link";
import { IconFileImport, IconPlus } from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { ToolbarSearch } from "@/components/layout/Toolbar/toolbar-search";
import { TOOLBAR_BUTTON_CLASS } from "@/components/layout/Toolbar/toolbar-button";
import { FilterPanel } from "@/components/filters/filter-panel";
import { LeadQuickFilterMenu } from "@/components/leads/lead-quick-filter-menu";
import { LeadSortMenu, type SortColumn } from "@/components/leads/lead-sort-menu";
import type { FilterCondition, FilterField, SortState } from "@/types";
import { PipelineSwitcher } from "./pipeline-switcher";

/**
 * The board Sort columns (KAN-07.1), exactly as Workpex lists them in
 * `kanban-sort-dropdown-open-columns-10-15-add-lead.png`: Lead Name, Lead Value,
 * Created Date — a shorter set than the Leads list Sort. "Lead Value" is the lead's
 * actual amount, which the list API already sorts by (`actualAmount`).
 */
const BOARD_SORT_COLUMNS: readonly SortColumn[] = [
  { key: "name", label: "Lead Name" },
  { key: "actualAmount", label: "Lead Value" },
  { key: "createdAt", label: "Created Date" },
];

type KanbanToolbarProps = {
  pipeline: string;
  onPipelineChange: (pipeline: string) => void;
  search: string;
  onSearchChange: (value: string) => void;
  filterFields: readonly FilterField[];
  filterActiveCount: number;
  filterValueOf: (key: string) => FilterCondition["value"];
  onFilterChange: (key: string, value: FilterCondition["value"]) => void;
  onFilterClear: () => void;
  sort: SortState | undefined;
  onSortChange: (sort: SortState) => void;
  activePreset: string | null;
  onQuickFilter: (id: string | null) => void;
  onNewLead: () => void;
};

/**
 * The board's shared toolbar (KAN-07.1). Every control is the Leads list's own —
 * New Lead, Search, Filter, Quick Filter, Sort — plus the KAN-06.1 pipeline switcher
 * and the Import link, in Workpex's exact board order (the `kanban-*` toolbar
 * screenshots): New Lead · Search · Filter · Lead Pipeline · Quick Filter · Sort ·
 * Import. No toolbar logic is duplicated; the board only supplies its own Sort
 * columns and wires the shared state the shell owns.
 */
export function KanbanToolbar({
  pipeline,
  onPipelineChange,
  search,
  onSearchChange,
  filterFields,
  filterActiveCount,
  filterValueOf,
  onFilterChange,
  onFilterClear,
  sort,
  onSortChange,
  activePreset,
  onQuickFilter,
  onNewLead,
}: KanbanToolbarProps) {
  return (
    <>
      <Button size="sm" onClick={onNewLead}>
        <IconPlus size={18} stroke={2} />
        New Lead
      </Button>
      <ToolbarSearch
        value={search}
        onChange={onSearchChange}
        placeholder="Search name or phone"
      />
      <FilterPanel
        fields={filterFields}
        activeCount={filterActiveCount}
        valueOf={filterValueOf}
        onChange={onFilterChange}
        onClear={onFilterClear}
      />
      <PipelineSwitcher value={pipeline} onChange={onPipelineChange} />
      <LeadQuickFilterMenu active={activePreset} onChange={onQuickFilter} />
      <LeadSortMenu
        sort={sort}
        onSortChange={onSortChange}
        columns={BOARD_SORT_COLUMNS}
      />
      <Link href="/leads/import" className={TOOLBAR_BUTTON_CLASS}>
        <IconFileImport size={18} stroke={1.75} />
        Import
      </Link>
    </>
  );
}
