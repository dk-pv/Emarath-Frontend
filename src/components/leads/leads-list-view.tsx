"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  IconColumns,
  IconFileImport,
  IconFileSearch,
  IconHistory,
  IconPlus,
} from "@tabler/icons-react";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { Table } from "@/components/ui/Table";
import { TablePageLayout } from "@/components/layout/TablePageLayout";
import { LeadAddColumnMenu } from "@/components/leads/lead-add-column-menu";
import { LeadBulkBar } from "@/components/leads/lead-bulk-bar";
import { LeadFormDrawer } from "@/components/leads/lead-form-drawer";
import {
  LeadManageColumnsDrawer,
  type ManageableColumn,
} from "@/components/leads/lead-manage-columns-drawer";
import { LeadExportMenu } from "@/components/leads/lead-export-menu";
import { LeadQuickFilterMenu } from "@/components/leads/lead-quick-filter-menu";
import { presetConditions } from "@/components/leads/lead-quick-filters";
import { LeadSortMenu } from "@/components/leads/lead-sort-menu";
import { leadColumns } from "@/components/leads/lead-columns";
import { useDebouncedValue } from "@/hooks/use-debounced-value";
import { useDisclosure } from "@/hooks/use-disclosure";
import { useFilters } from "@/hooks/use-filters";
import { useListData } from "@/hooks/use-list-data";
import { useListQuery } from "@/hooks/use-list-query";
import {
  fetchLeadFilterOptions,
  fetchLeads,
  type LeadFilterOptions,
} from "@/services/leads-service";
import {
  downloadLeadsExport,
  type ExportFormat,
  type ExportScope,
} from "@/services/leads-export-service";
import {
  fetchColumnLayout,
  LEADS_VIEW_KEY,
  reconcileLayout,
  saveColumnLayout,
} from "@/services/view-preferences-service";
import type { FilterCondition, FilterField, FilterState } from "@/types";

const NO_OPTIONS: LeadFilterOptions = { sources: [], statuses: [], agents: [] };

/** A pause after the last keystroke before the server search runs (LEAD-03.3). */
const SEARCH_DEBOUNCE_MS = 300;

/**
 * The real Leads list (LEAD-02.2) with search, filter and sort wired in
 * (LEAD-03.3). Everything is a composition of the Foundation: the toolbar,
 * SearchInput and FilterPanel come from TablePageLayout, filter state from
 * useFilters, paging/sort from useListQuery, and fetching from useListData — no
 * bespoke toolbar, popup or search component is introduced.
 *
 * Search is debounced so a 15,000+ row query does not run per keystroke, while
 * the box stays controlled by the live value. Filter options are faceted from
 * the caller's scoped leads, so an agent is only ever offered sources, statuses
 * and agents that appear on leads they may open.
 */
export function LeadsListView() {
  const [options, setOptions] = useState<LeadFilterOptions>(NO_OPTIONS);

  useEffect(() => {
    const controller = new AbortController();
    fetchLeadFilterOptions(controller.signal)
      .then(setOptions)
      .catch((error: unknown) => {
        // A superseded request aborts; that is expected. Any other failure just
        // leaves the filter menu empty — the list itself still works.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, []);

  const filterFields = useMemo<FilterField[]>(
    () => [
      {
        key: "source",
        label: "Source",
        type: "multi",
        options: options.sources.map((value) => ({ label: value, value })),
      },
      {
        key: "status",
        label: "Lead Status",
        type: "multi",
        options: options.statuses.map((value) => ({ label: value, value })),
      },
      {
        key: "assignedAgent",
        label: "Assigned Agent",
        type: "multi",
        options: options.agents.map((agent) => ({
          label: agent.name,
          value: agent.id,
        })),
      },
    ],
    [options],
  );

  const filters = useFilters(filterFields);

  // Quick Filter preset (LEAD-04.1). One preset at a time; its conditions ride the
  // same list query as the field filters, so no new filter path exists. Kept in its
  // own state (not the panel's) so the active preset can be indicated and cleared
  // independently.
  const [activePreset, setActivePreset] = useState<string | null>(null);
  const [presetFilters, setPresetFilters] = useState<FilterCondition[]>([]);

  // The box tracks the live value; only the value that drives the fetch waits.
  const debouncedSearch = useDebouncedValue(
    filters.state.search,
    SEARCH_DEBOUNCE_MS,
  );
  const queryState = useMemo<FilterState>(
    () => ({
      search: debouncedSearch,
      conditions: [...filters.state.conditions, ...presetFilters],
    }),
    [debouncedSearch, filters.state.conditions, presetFilters],
  );

  const list = useListQuery({ filters: queryState });

  // Apply a preset (or clear with null); the menu resolves a re-select to null.
  const applyQuickFilter = (id: string | null) => {
    setActivePreset(id);
    setPresetFilters(id ? presetConditions(id) : []);
    list.resetPage();
  };
  const { rows, total, isLoading, isError, refetch } = useListData(
    fetchLeads,
    list.query,
  );

  const newLead = useDisclosure();
  const pageCount = Math.max(1, Math.ceil(total / list.size));

  // Bulk selection (LEAD-09.2). Ids accumulate across pages, so a select-all on
  // one page adds only that page's rows and the count carries over, matching
  // Workpex's persistent "N Lead Selected" bar.
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );

  const toggleRow = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAll = (ids: string[]) =>
    setSelectedIds((prev) => {
      const allSelected = ids.every((id) => prev.has(id));
      const next = new Set(prev);
      for (const id of ids) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });

  // Custom columns (LEAD-05.1). Customer Name (the frozen identifier) and the row
  // actions are fixed; every other column can be reordered and shown or hidden.
  const manageableColumns = useMemo<ManageableColumn[]>(
    () =>
      leadColumns
        .filter((column) => column.key !== "name" && column.key !== "actions")
        .map((column) => ({ key: column.key, label: String(column.header) })),
    [],
  );

  // The layout starts at the default and is replaced once the caller's saved
  // layout loads (AC3). Order and the hidden set persist per user server-side.
  const [columnOrder, setColumnOrder] = useState<string[]>(() =>
    manageableColumns.map((column) => column.key),
  );
  const [hiddenColumns, setHiddenColumns] = useState<string[]>([]);
  const manageColumns = useDisclosure();

  useEffect(() => {
    const controller = new AbortController();
    fetchColumnLayout(LEADS_VIEW_KEY, controller.signal)
      .then((saved) => {
        const layout = reconcileLayout(
          saved,
          manageableColumns.map((column) => column.key),
        );
        setColumnOrder(layout.order);
        setHiddenColumns(layout.hidden);
      })
      .catch((error: unknown) => {
        // A superseded request aborts; expected. Any other failure just leaves
        // the default layout in place — the table still renders.
        if (error instanceof DOMException && error.name === "AbortError")
          return;
      });
    return () => controller.abort();
  }, [manageableColumns]);

  const visibleColumns = useMemo(() => {
    const byKey = new Map(leadColumns.map((column) => [column.key, column]));
    const hidden = new Set(hiddenColumns);
    const orderedKeys = [
      "name",
      ...columnOrder.filter((key) => !hidden.has(key)),
      "actions",
    ];
    return orderedKeys
      .map((key) => byKey.get(key))
      .filter((column): column is (typeof leadColumns)[number] =>
        Boolean(column),
      );
  }, [columnOrder, hiddenColumns]);

  // Export (LEAD-08.1). Downloads the current view — the same query the list runs
  // (search/filter/sort/scope) — in the chosen format. "My Default" sends the
  // visible data columns in order; Actions is a control, not data, so it is dropped.
  const handleExport = (format: ExportFormat, scope: ExportScope) => {
    const columnKeys = visibleColumns
      .map((column) => column.key)
      .filter((key) => key !== "actions");
    downloadLeadsExport(format, scope, list.query, columnKeys);
  };

  return (
    <>
      <TablePageLayout
        title="Leads"
        tableLabel="Leads table"
        search={{
          value: filters.state.search,
          onChange: (value) => {
            filters.setSearch(value);
            list.resetPage();
          },
          placeholder: "Search name or phone",
        }}
        filters={{
          fields: filterFields,
          conditions: filters.active,
          activeCount: filters.activeCount,
          valueOf: filters.valueOf,
          fieldOf: filters.fieldOf,
          onChange: (key, value) => {
            filters.setCondition(key, value);
            list.resetPage();
          },
          onRemove: (key) => {
            filters.removeCondition(key);
            list.resetPage();
          },
          onClear: () => {
            filters.clearAll();
            list.resetPage();
          },
        }}
        toolbarActions={
          <>
            <Button onClick={newLead.open}>
              <IconPlus size={18} stroke={2} />
              New Lead
            </Button>
            <LeadSortMenu sort={list.sort} onSortChange={list.setSort} />
            <LeadQuickFilterMenu
              active={activePreset}
              onChange={applyQuickFilter}
            />
            <LeadAddColumnMenu />
            <button
              type="button"
              onClick={manageColumns.open}
              className="focus-ring inline-flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink"
            >
              <IconColumns size={18} stroke={1.75} />
              Manage Columns
            </button>
            <Link
              href="/leads/import"
              className="focus-ring inline-flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink"
            >
              <IconFileImport size={18} stroke={1.75} />
              Import
            </Link>
            <Link
              href="/leads/import/history"
              className="focus-ring inline-flex h-control-md items-center gap-2 rounded-control border border-hairline bg-surface px-field-x text-sm text-ink"
            >
              <IconHistory size={18} stroke={1.75} />
              Import History
            </Link>
            <LeadExportMenu onExport={handleExport} />
          </>
        }
        // The footer only belongs on a populated list: during loading, an error,
        // or a genuinely empty result there is nothing to page, and a "0 results"
        // footer would read as a wrong answer rather than a pending one.
        pagination={
          total > 0
            ? {
                page: list.page,
                pageCount,
                total,
                onPageChange: list.setPage,
                pageSize: list.size,
                onPageSizeChange: list.setSize,
              }
            : undefined
        }
      >
        <Table
          columns={visibleColumns}
          rows={rows}
          getRowId={(row) => row.id}
          selection={{
            selectedIds,
            onToggleRow: toggleRow,
            onToggleAll: toggleAll,
            rowLabel: (row) => `Select ${row.name}`,
            allLabel: "Select all leads on this page",
          }}
          isLoading={isLoading}
          emptyState={
            <EmptyState
              icon={IconFileSearch}
              title="No data available"
              description="There's no data for the selected date range or filters. Try adjusting your filters to see more results."
            />
          }
          errorState={
            isError ? (
              <ErrorState
                title="Couldn’t load leads"
                description="Something went wrong while loading leads. Check your connection and try again."
                onRetry={refetch}
              />
            ) : undefined
          }
        />
      </TablePageLayout>

      {selectedIds.size > 0 && (
        <LeadBulkBar
          count={selectedIds.size}
          onClear={() => setSelectedIds(new Set())}
        />
      )}

      {/* Mounted only while open, so every New Lead starts from a clean form. */}
      {newLead.isOpen && (
        <LeadFormDrawer
          open
          onClose={newLead.close}
          onCreated={() => {
            newLead.close();
            refetch();
          }}
        />
      )}

      {/* Mounted per-open so the draft always starts from the applied columns. */}
      {manageColumns.isOpen && (
        <LeadManageColumnsDrawer
          open
          columns={manageableColumns}
          order={columnOrder}
          hidden={hiddenColumns}
          onClose={manageColumns.close}
          onApply={(order, hidden) => {
            setColumnOrder(order);
            setHiddenColumns(hidden);
            // Persist per user (AC3). Optimistic: the table already reflects the
            // change, so a failed save only means it won't survive a reload.
            void saveColumnLayout(LEADS_VIEW_KEY, { order, hidden }).catch(
              () => {},
            );
          }}
        />
      )}
    </>
  );
}
